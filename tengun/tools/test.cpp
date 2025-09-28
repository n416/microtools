// test.cpp (最小単位のテスト・修正版)
#include <emscripten/bind.h>
#include <string>
#include <sstream>

// mkazhdanのコードの中から、Pointクラスの定義だけを拝借する
#include "src/Geometry.h"

// JavaScriptから呼び出すテスト関数
std::string run_point_class_test() {
    // 【修正点1】PoissonRecon:: をつける
    PoissonRecon::Point<float, 3> p1, p2, p3;

    p1[0] = 1.0f; p1[1] = 2.0f; p1[2] = 3.0f;
    p2[0] = 4.0f; p2[1] = 5.0f; p2[2] = 6.0f;

    p3 = p1 + p2;

    std::stringstream ss;
    ss << "Pointクラスのテスト成功！ p1(1,2,3) + p2(4,5,6) = p3("
       << p3[0] << ", " << p3[1] << ", " << p3[2] << ")";
    return ss.str();
}

// Emscriptenのためのバインディング設定
EMSCRIPTEN_BINDINGS(my_module) {
    emscripten::function("runPointClassTest", &run_point_class_test);
}