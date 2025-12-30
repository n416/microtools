let slidesData = {
  "meta": {
    "version": 1,
    "lastModified": "2025-12-05T23:01:45.000Z",
    "systemName": "AISlideSystem_Sample"
  },
  "slides": [
    {
      "type": "main-cover",
      "title": "サンプル・プレゼンテーション",
      "subtitle": "全てのレイアウトテンプレートを確認するための\nダミーデータです。"
    },
    {
      "type": "chapter-cover",
      "title": "基本レイアウト",
      "desc": "以下、システムで利用可能なレイアウトの一覧です。"
    },
    {
      "layout": "standard",
      "chapter": "Basic",
      "title": "Standard (標準レイアウト)",
      "points": [
        "左側に箇条書きテキスト、右側に画像を配置する基本レイアウトです。",
        "最も汎用性が高く、説明とビジュアルをセットで提示するのに適しています。",
        "画像はクリックして編集モードで差し替え可能です。"
      ],
      "img": "capture/sample.png"
    },
    {
      "layout": "impact",
      "chapter": "Comparison",
      "title": "Impact (Before/After)",
      "beforeTitle": "導入前 (Before)",
      "beforeText": "課題や問題点をここに記載します。<br>テキストはHTMLタグも一部使用可能です。",
      "afterTitle": "導入後 (After)",
      "afterText": "解決後の理想的な状態をここに記載します。<br>右向きの矢印で変化を強調します。"
    },
    {
      "layout": "big-number",
      "chapter": "Statistics",
      "title": "Big Number (数値強調)",
      "mainText": "改善率 <span class='huge-number'>120</span> %",
      "subText": "ここには数値に関する補足説明や、詳細なデータを記載します。"
    },
    {
      "layout": "wide",
      "chapter": "Feature",
      "title": "Wide (画像 + 3カラム)",
      "points": [
        "<b>ポイント1</b><br>画像の下に3つのポイントを並列で配置できます。",
        "<b>ポイント2</b><br>機能の羅列や、ステップごとの説明に適しています。",
        "<b>ポイント3</b><br>ワイドな画像を使って視覚的なインパクトを出せます。"
      ],
      "img": "capture/sample.png"
    },
    {
      "layout": "roadmap",
      "chapter": "Schedule",
      "title": "Roadmap (進行ステップ)",
      "desc": "プロジェクトの進行予定や、導入ステップを表示するレイアウトです。",
      "steps": [
        {
          "title": "Step 1",
          "desc": "ヒアリングと現状分析"
        },
        {
          "title": "Step 2",
          "desc": "初期設定とテスト運用"
        },
        {
          "title": "Step 3",
          "desc": "本格稼働と定着支援"
        }
      ]
    },
    {
      "layout": "pricing",
      "chapter": "Plan",
      "title": "Pricing (料金プラン)",
      "note": "※価格は税抜き表示です。オプションは別途ご相談ください。",
      "plans": [
        {
          "name": "ライトプラン",
          "price": "10,000",
          "unit": "円/月",
          "features": [
            {
              "label": "ユーザー数",
              "val": "5名"
            },
            {
              "label": "サポート",
              "val": "メール"
            }
          ],
          "highlight": false
        },
        {
          "name": "スタンダード",
          "price": "30,000",
          "unit": "円/月",
          "features": [
            {
              "label": "ユーザー数",
              "val": "20名"
            },
            {
              "label": "サポート",
              "val": "電話・Web"
            }
          ],
          "highlight": true
        },
        {
          "name": "エンタープライズ",
          "price": "個別見積",
          "unit": "",
          "features": [
            {
              "label": "ユーザー数",
              "val": "無制限"
            },
            {
              "label": "サポート",
              "val": "専任担当"
            }
          ],
          "highlight": false
        }
      ]
    },
    {
      "layout": "message",
      "chapter": "Closing",
      "title": "Message (メッセージ)",
      "text": "最後に伝えたい想いや、理念を記載するシンプルなレイアウトです。<br>中央揃えでテキストが配置され、余白を生かしたデザインになります。"
    }
  ]
};
