export const CharacterNames = {
  main_prog: {
    hiragana: "こばやし ゆうた",
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
      ceo: { // 桐島から
        normal: "小林",
        full_nospace: "小林悠太"
      },
      client_pm: { // 篠原から
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
    hiragana: "きりしま けい",
    age: 34,
    callers: {
      system: {
        normal: "桐島",
        normal_san: "桐島さん",
        full: "桐島 慧",
        full_nospace: "桐島慧",
        title: "社長"
      },
      main_prog: { // 小林から
        normal_san: "桐島さん",
        title: "社長"
      },
      ceo: { // 自分自身
        normal: "俺",
        title: "社長"
      },
      client_pm: { // 篠原から
        normal: "桐島さん"
      },
      senior_eng: { // 相馬から
        normal: "桐島"
      }
    }
  },
  client_pm: {
    hiragana: "しのはら あかね",
    age: 30,
    callers: {
      system: {
        normal: "篠原",
        normal_san: "篠原さん",
        first_san: "茜さん",
        full: "篠原 茜"
      },
      main_prog: { // 小林から
        normal_san: "篠原さん"
      },
      ceo: { // 桐島から
        normal: "篠原",
        normal_san: "篠原さん"
      },
      junior_dir: { // 佐々木から
        title: "先輩",
        normal: "茜さん" // 文脈によってどちらか
      }
    }
  },
  senior_eng: {
    hiragana: "そうま けんいち",
    age: 32,
    callers: {
      system: {
        normal: "相馬",
        normal_san: "相馬さん",
        full: "相馬 健一"
      },
      main_prog: { // 小林から
        normal_san: "相馬さん"
      },
      ceo: { // 桐島から
        normal: "相馬"
      }
    }
  },
  cafe_clerk: {
    hiragana: "いとう ゆい",
    age: 22,
    callers: {
      system: {
        normal: "結衣",
        normal_san: "結衣ちゃん",
        last_san: "伊藤さん",
        full: "伊藤 結衣"
      },
      main_prog: { // 小林から
        normal: "結衣", // 心の中や基本
        last_san: "伊藤さん" // 仕事中や序盤
      },
      ceo: { // 桐島から
        normal: "結衣ちゃん",
        normal_san: "結衣ちゃん",
        short: "結衣"
      }
    }
  },
  client_pmo: {
    hiragana: "くろす たかゆき",
    age: 48,
    callers: {
      system: {
        normal: "黒須",
        normal_san: "黒須さん",
        full: "黒須 孝之"
      },
      main_prog: { // 小林から
        normal: "黒須さん" // (あれば)
      },
      ceo: { // 桐島から
        normal: "黒須さん", // 表向き
        enemy: "黒須"      // 裏の顔
      },
      client_pm: { // 篠原から
        normal: "黒須さん"
      }
    }
  },
  underground_fixer: {
    hiragana: "むらた てっぺい",
    age: "年齢不詳",
    callers: {
      system: {
        normal: "テツ",
        last_san: "村田さん",
        full: "村田 “テツ” 鉄平"
      },
      ceo: { // 桐島から
        normal: "テツ"
      },
      main_prog: { // 小林から
        normal: "テツさん" // もしくは「テツ」
      }
    }
  },
  junior_dir: {
    hiragana: "ささき まい",
    age: 24,
    callers: {
      system: {
        normal: "佐々木",
        normal_san: "佐々木さん",
        first: "麻衣",
        full: "佐々木 麻衣"
      },
      client_pm: { // 篠原から
        normal: "佐々木" // または麻衣
      },
      ceo: { // 桐島から
        normal: "佐々木さん",
        normal_san: "佐々木さん"
      }
    }
  }
};
