// Test file for Japanese translation and Gemini API improvements
import React from "react";

const JapaneseTest: React.FC = () => {
  return (
    <div className="p-4 bg-black/60 text-white rounded-lg">
      <h1 className="text-xl font-bold mb-4">日本語テスト</h1>
      
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">UIテキスト</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>表示/非表示</li>
            <li>スクリーンショットを撮る</li>
            <li>問題を解決</li>
            <li>音声録音</li>
            <li>チャット</li>
            <li>サインアウト</li>
            <li>キーボードショートカット</li>
            <li>ウィンドウ切り替え</li>
            <li>スクリーンショット結果</li>
            <li>音声結果</li>
          </ul>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold">Gemini APIテスト</h2>
          <p className="text-sm">
            日本語での応答が簡潔で構造化されていることを確認してください。
          </p>
        </div>
      </div>
    </div>
  );
};

export default JapaneseTest;