import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  const { input, tone, length } = await req.json();

  if (!input?.trim()) {
    return new Response(JSON.stringify({ error: "입력값이 없습니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const lengthGuide = {
    short: "500자 내외",
    medium: "1000~1500자",
    long: "2000자 이상",
  }[length as string] ?? "1000~1500자";

  const toneGuide = {
    info: "정보 전달형 (객관적, 전문적)",
    casual: "친근한 구어체 (편안하고 자연스럽게)",
    story: "스토리텔링형 (감성적, 서사적)",
  }[tone as string] ?? "정보 전달형";

  const systemPrompt = `당신은 한국어 블로그 전문 작가입니다.
사용자가 키워드나 짧은 문장을 제공하면 SEO에 최적화된 고품질 블로그 글을 작성해주세요.

작성 규칙:
- 제목은 ## 으로, 소제목은 ### 으로 표시
- 글의 톤: ${toneGuide}
- 글의 길이: ${lengthGuide}
- 마지막에 해시태그 5~7개 추가 (예: #블로그 #키워드)
- 마크다운 형식으로 작성
- 독자의 관심을 끄는 매력적인 제목 작성`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const response = await client.messages.stream({
        model: "claude-opus-4-6",
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `다음 내용으로 블로그 글을 작성해주세요:\n\n${input}`,
          },
        ],
      });

      for await (const event of response) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(event.delta.text));
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
