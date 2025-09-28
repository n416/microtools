// test2.cpp (主要ヘッダーのコンパイル検証)
#include <emscripten/bind.h>
#include <string>

#include "src/PreProcessor.h"
#include "src/PPolynomial.h"
#include "src/FEMTree.h"

std::string run_header_inclusion_test() {
    return "主要ヘッダーのインクルードとコンパイルに成功。";
}

EMSCRIPTEN_BINDINGS(my_module) {
    emscripten::function("runHeaderInclusionTest", &run_header_inclusion_test);
}