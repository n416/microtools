#include <emscripten.h>
#include <iostream>
#include <vector>
#include <string>
#include "src/Reconstructors.h"
#include "src/DataStream.imp.h"
#include "src/PointExtent.h"

// Point, Normal, VectorBackedInputDataStream などの定義は変更なし

extern "C" {
    EMSCRIPTEN_KEEPALIVE
    const char* runSolverSolveTest() {
        try {
            // ... (関数の中身は変更なし) ...

            // 成功メッセージ
            return "成功";
        }
        catch (const std::exception& e) {
            static std::string errorMessage;
            errorMessage = e.what();
            return errorMessage.c_str();
        }
    }
}