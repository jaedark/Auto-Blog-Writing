import { NextRequest } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const TAVILY_API_KEY = process.env.TAVILY_API_KEY ?? "";

async function searchTavily(query: string): Promise<string> {
  if (!TAVILY_API_KEY) return "";

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: true,
    }),
  });

  if (!res.ok) return "";

  const data = await res.json();
  const results: string[] = [];

  if (data.answer) {
    results.push(`[요약 답변]\n${data.answer}`);
  }

  for (const r of data.results ?? []) {
    results.push(`[출처: ${r.url}]\n${r.content}`);
  }

  return results.join("\n\n");
}

export async function POST(req: NextRequest) {
  const { input, tone, length } = await req.json();

  if (!input?.trim()) {
    return new Response(JSON.stringify({ error: "입력값이 없습니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!GROQ_API_KEY) {
    return new Response(
      JSON.stringify({ error: "GROQ_API_KEY가 설정되지 않았습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const lengthGuide = {
    short: "본문 400~600자(공백 제외). 600자를 절대 넘지 말고 400자 미만도 안 됩니다.",
    medium: "본문 1000~1500자(공백 제외). 1000자 미만이거나 1500자 초과는 안 됩니다.",
    long: "본문 2000~2500자(공백 제외). 반드시 2000자 이상 작성하고 2500자를 넘지 마세요.",
  }[length as string] ?? "본문 1000~1500자(공백 제외). 1000자 미만이거나 1500자 초과는 안 됩니다.";

  const toneGuide = {
    info: "정보 전달형 (객관적, 전문적)",
    casual: "친근한 구어체 (편안하고 자연스럽게)",
    story: "스토리텔링형 (감성적, 서사적)",
  }[tone as string] ?? "정보 전달형";

  const searchContext = await searchTavily(input);

  const systemPrompt = `당신은 한국어 블로그 전문 작가입니다.
사용자가 키워드나 짧은 문장을 제공하면 SEO에 최적화된 고품질 블로그 글을 작성해주세요.
${searchContext ? "\n아래 최신 검색 결과를 참고하여 정확하고 풍부한 내용을 작성하세요:\n" + searchContext + "\n" : ""}
작성 규칙:
- 제목은 ## 으로, 소제목은 ### 으로 표시
- 글의 톤: ${toneGuide}
- 글의 길이: ${lengthGuide} 해시태그는 글자수에 포함하지 않습니다. 작성 전에 소제목별 분량을 미리 계획하고 글자수를 맞추세요.
- 마지막에 해시태그를 반드시 정확히 30개 작성 (예: #블로그 #키워드 #SEO ...)
- 해시태그는 한 줄에 공백으로 구분하여 나열
- 마크다운 형식으로 작성
- 독자의 관심을 끄는 매력적인 제목 작성`;

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `다음 내용으로 블로그 글을 작성해주세요. 반드시 ${lengthGuide}\n\n${input}` },
      ],
    }),
  });

  if (!groqRes.ok || !groqRes.body) {
    return new Response(
      JSON.stringify({ error: "Groq API 호출에 실패했습니다. API 키를 확인하세요." }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const reader = groqRes.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(data);
            const text = json.choices?.[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            // 파싱 실패한 라인 무시
          }
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
