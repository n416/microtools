export const CharacterNames = {
  main_prog: {
    furigana: "こばやし ゆうた",
    age: 28,
    callers: {
      system: { // 地の文や誰とも特定できない場合
        normal: "小林",
        normal_san: "小林さん",
        full: "小林 悠太",
        full_nospace: "小林悠太",
        title: "プログラマ"
      },
      main_prog: { // 小林自身から
        normal: "俺",
        full_nospace: "小林悠太",
        full: "小林 悠太"
      },
      ceo: { // 土屋から
        normal: "小林",
        full_nospace: "小林悠太",
        normal_san: "小林さん"
      },
      client_pm: { // 天宮から
        normal: "小林さん",
        normal_san: "小林さん"
      },
      senior_eng: { // 相馬から
        normal: "小林"
      },
      cafe_clerk: { // 結衣から
        normal: "小林さん",
        normal_san: "小林さん"
      }
    }
  },
  ceo: {
    furigana: "つちや そういち",
    age: 34,
    callers: {
      system: { // 地の文や誰とも特定できない場合
        normal: "土屋",
        normal_san: "土屋さん",
        full: "土屋 創一",
        full_nospace: "土屋創一",
        title: "社長"
      },
      main_prog: { // 小林から
        normal_san: "土屋さん",
        title: "社長"
      },
      ceo: { // 土屋自身から
        normal: "俺",
        title: "社長"
      },
      client_pm: { // 天宮から
        normal: "土屋さん"
      },
      senior_eng: { // 相馬から
        normal: "土屋"
      },
      client_pmo: { // 黒須から
        normal: "土屋"
      },
      underground_fixer: { // テツから
        normal: "土屋"
      }
    }
  },
  client_pm: {
    furigana: "あまみや もね",
    age: 30,
    callers: {
      system: { // 地の文や誰とも特定できない場合
        normal: "天宮",
        normal_san: "天宮さん",
        first_san: "もねさん",
        full: "天宮 百音",
        full_nospace: "天宮百音"
      },
      main_prog: { // 小林から
        normal_san: "天宮さん"
      },
      ceo: { // 土屋から
        normal: "天宮",
        normal_san: "天宮さん"
      },
      junior_dir: { // 佐々木から
        title: "先輩",
        normal: "もねさん" // 文脈によってどちらか
      },
      client_pmo: { // 黒須から
        normal_san: "天宮さん"
      }
    }
  },
  senior_eng: {
    furigana: "そうま けん",
    age: 32,
    callers: {
      system: { // 地の文や誰とも特定できない場合
        normal: "相馬",
        normal_san: "相馬さん",
        full: "相馬 健"
      },
      main_prog: { // 小林から
        normal_san: "相馬さん"
      },
      ceo: { // 土屋から
        normal: "相馬"
      }
    }
  },
  cafe_clerk: {
    furigana: "いとう ゆい",
    age: 22,
    callers: {
      system: { // 地の文や誰とも特定できない場合
        normal: "結衣",
        normal_san: "結衣ちゃん",
        last_san: "伊藤さん",
        full: "伊藤 結衣"
      },
      main_prog: { // 小林から
        normal: "結衣", // 心の中や基本
        last_san: "伊藤さん" // 仕事中や序盤
      },
      ceo: { // 土屋から
        normal: "結衣ちゃん",
        normal_san: "結衣ちゃん",
        short: "結衣"
      }
    }
  },
  client_pmo: {
    furigana: "くろす たかゆき",
    age: 48,
    callers: {
      system: { // 地の文や誰とも特定できない場合
        normal: "黒須",
        normal_san: "黒須さん",
        full: "黒須 孝之"
      },
      main_prog: { // 小林から
        normal: "黒須さん" // (あれば)
      },
      ceo: { // 土屋から
        normal: "黒須さん", // 表向き
        enemy: "黒須",      // 裏の顔
        normal_san: "黒須さん"
      },
      client_pm: { // 天宮から
        normal: "黒須さん",
        normal_san: "黒須さん"
      }
    }
  },
  underground_fixer: {
    furigana: "むらた てっぺい",
    age: "年齢不詳",
    callers: {
      system: { // 地の文や誰とも特定できない場合
        normal: "テツ",
        last: "村田",
        last_san: "村田さん",
        full: "村田 “テツ” 鉄平"
      },
      ceo: { // 土屋から
        normal: "テツ"
      },
      main_prog: { // 小林から
        normal: "テツさん" // もしくは「テツ」
      }
    }
  },
  junior_dir: {
    furigana: "ささき まい",
    age: 24,
    callers: {
      system: { // 地の文や誰とも特定できない場合
        normal: "佐々木",
        normal_san: "佐々木さん",
        first: "麻衣",
        full: "佐々木 麻衣"
      },
      client_pm: { // 天宮から
        normal: "佐々木" // または麻衣
      },
      ceo: { // 土屋から
        normal: "佐々木さん",
        normal_san: "佐々木さん"
      }
    }
  }
};
