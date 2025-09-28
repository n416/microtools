// test3.cpp (最初の部品テスト：FEMTreeのインスタンス化)
#include <emscripten/bind.h>
#include <string>

// -- 必要なヘッダー --
#include "src/PreProcessor.h"
#include "src/FEMTree.h"

// -- テスト関数 --
std::string run_femtree_test() {
    // using namespace PoissonRecon; を使わず、フルネームで指定
    
    // ★★★ 今回のテスト対象 ★★★
    // FEMTreeクラスのインスタンスを作成できるか？
    PoissonRecon::FEMTree<3, float> tree( MEMORY_ALLOCATOR_BLOCK_SIZE );
    
    return "部品テスト成功：FEMTreeクラスのインスタンス化に成功しました。";
}

// -- Emscriptenのためのバインディング設定 --
EMSCRIPTEN_BINDINGS(my_module) {
    emscripten::function("runFemtreeTest", &run_femtree_test);
}