"use client";

import { useState, useRef } from "react";

type Tone = "info" | "casual" | "story";
type Length = "short" | "medium" | "long";

function renderMarkdown(text: string) {
  return text
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|u|l])(.+)$/gm, (m) => m ? m : '')
    .replace(/^<\/p><p>(<[hu])/, '$1')
    .trim();
}

export default function Home() {
  const [input, setInput] = useState("");
  const [tone, setTone] = useState<Tone>("info");
  const [length, setLength] = useState<Length>("medium");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  async function generate() {
    if (!input.trim() || loading) return;
    setOutput("");
    setLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, tone, length }),
      });

      if (!res.ok) throw new Error("생성 실패");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
        setOutput(result);
        outputRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    } catch {
      setOutput("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tones: { value: Tone; label: string; emoji: string }[] = [
    { value: "info", label: "정보형", emoji: "📊" },
    { value: "casual", label: "친근한", emoji: "😊" },
    { value: "story", label: "스토리", emoji: "✨" },
  ];

  const lengths: { value: Length; label: string; desc: string }[] = [
    { value: "short", label: "짧게", desc: "~500자" },
    { value: "medium", label: "보통", desc: "1000~1500자" },
    { value: "long", label: "길게", desc: "2000자+" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            ✍️ 블로그 자동 작성기
          </h1>
          <p className="text-slate-500 text-sm">
            키워드나 짧은 문장을 입력하면 블로그 글을 자동으로 작성해드립니다
          </p>
        </div>

        {/* 입력 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            키워드 또는 주제 입력
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="예: 제주도 여행 추천 코스&#10;예: 파이썬으로 업무 자동화하는 방법&#10;예: 아침 루틴이 삶을 바꾸는 이유"
            className="w-full h-32 p-3 text-slate-700 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) generate();
            }}
          />
          <p className="text-xs text-slate-400 mt-1">Ctrl+Enter로 빠르게 생성</p>

          {/* 톤 선택 */}
          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">글 톤</p>
            <div className="flex gap-2">
              {tones.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                    tone === t.value
                      ? "bg-blue-500 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 길이 선택 */}
          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">글 길이</p>
            <div className="flex gap-2">
              {lengths.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLength(l.value)}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                    length === l.value
                      ? "bg-blue-500 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {l.label}
                  <span className="block text-xs opacity-70">{l.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 생성 버튼 */}
          <button
            onClick={generate}
            disabled={loading || !input.trim()}
            className="w-full mt-5 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-semibold rounded-xl transition-all text-sm shadow-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⚙️</span> 블로그 작성 중...
              </span>
            ) : (
              "🚀 블로그 글 생성하기"
            )}
          </button>
        </div>

        {/* 결과 카드 */}
        {output && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700">생성된 블로그 글</h2>
              <button
                onClick={copyToClipboard}
                className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all font-medium"
              >
                {copied ? "✅ 복사됨" : "📋 복사"}
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              글자수: {output.replace(/\s/g, "").length.toLocaleString()}자 (공백 제외)
            </p>
            <div
              ref={outputRef}
              className="prose text-slate-700 text-sm leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(output) }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
