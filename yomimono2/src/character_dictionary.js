export const CharacterNames = {
  alto: {
    furigana: "あると",
    age: 16, // 外見は40代・90代など推移
    callers: {
      system: { // 地の文
        normal: "アルト",
        full: "アルト",
        title: "灰の少年"
      },
      mia: {
        normal: "アルト",
        insult: "バカ",
        insult2: "大マヌケ",
        insult3: "すっとこどっこい",
        title: "お前"
      },
      villain: {
        normal: "アルト",
        title: "欠陥品"
      }
    }
  },
  mia: {
    furigana: "みあ",
    age: 300, // 外見は12歳
    callers: {
      system: {
        normal: "ミア",
        title: "魔女" // 地の文によっては幼女
      },
      alto: {
        normal: "ミア",
        title: "お前"
      },
      pamonana: {
        normal: "ミア",
        normal_san: "ミアさん"
      }
    }
  },
  villain: {
    furigana: "ゔぃらん",
    age: "不明",
    callers: {
      system: {
        normal: "ヴィラン",
        title: "悪徳仲介屋"
      },
      alto: {
        normal: "お前",
        title: "ヴィラン"
      }
    }
  },
  pamonana: {
    furigana: "ぱもなな",
    age: 300,
    callers: {
      system: {
        normal: "パモナナ",
        title: "老婆の魔法使い"
      },
      mia: {
        normal: "パモナナ"
      }
    }
  },
  gina: {
    furigana: "じーな",
    age: "故人",
    callers: {
      system: {
        normal: "ジーナ",
        title: "原初の設計者"
      },
      pamonana: {
        normal: "先生",
        full: "ジーナ先生"
      }
    }
  }
};
