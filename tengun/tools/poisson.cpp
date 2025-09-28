#include <iostream>
#include <vector>
#include <emscripten.h>
#include <cmath>

#include "PreProcessor.h"
#include "Reconstructors.h"
#include "FEMTree.h"
#include "PPolynomial.h"
#include "Ply.h"
#include "VertexFactory.h"
#include "DataStream.imp.h"
#include "MultiThreading.h"
#include "CmdLineParser.h"

using namespace PoissonRecon;

// --- グローバル変数のextern宣言 ---
extern CmdLineParameter< int > Degree , Depth , KernelDepth , FullDepth , BType , Iters;
extern CmdLineParameter< float > Scale , SamplesPerNode , PointWeight , DataX;
extern CmdLineReadable NonManifold , Verbose;


// --- JavaScriptから呼び出されるメイン処理関数 ---
extern "C" EMSCRIPTEN_KEEPALIVE
float* process( float* points, int num_points, int depth, float samples_per_node, float scale, int& num_vertices, int& num_faces )
{
    using Real = float;
    const unsigned int Dim = 3;

    // --- 1. グローバル変数の設定 ---
    Depth.value = depth;
    SamplesPerNode.value = samples_per_node;
    Scale.value = scale;
    Degree.value = 2;
    BType.value = BOUNDARY_NEUMANN + 1;
    KernelDepth.value = depth > 2 ? depth - 2 : 0;
    FullDepth.value = 5;
    DataX.value = 32.f;
    Iters.value = 8;
    PointWeight.value = Reconstructor::Poisson::WeightMultiplier * Degree.value;
    NonManifold.set = true;
    Verbose.set = false;

    // --- 2. 入力データの準備 ---
    using VFactory = VertexFactory::NormalFactory< Real , Dim >;
    using PFactory = VertexFactory::PositionFactory< Real , Dim >;
    using SampleFactory = VertexFactory::Factory< Real , PFactory, VFactory >;
    using Sample = typename SampleFactory::VertexType;
    std::vector< Sample > samples( num_points );
    for( int i=0; i<num_points; ++i )
    {
        samples[i].template get<0>().coords[0] = points[i*6+0];
        samples[i].template get<0>().coords[1] = points[i*6+1];
        samples[i].template get<0>().coords[2] = points[i*6+2];
        samples[i].template get<1>().coords[0] = points[i*6+3];
        samples[i].template get<1>().coords[1] = points[i*6+4];
        samples[i].template get<1>().coords[2] = points[i*6+5];
    }
    VectorBackedInputDataStream< Sample > pointStream( samples );

    // --- 3. コア処理の実行 ---
    typename Reconstructor::Poisson::SolutionParameters<Real> sParams{};
    sParams.depth = Depth.value;
    sParams.kernelDepth = KernelDepth.value;
    sParams.fullDepth = FullDepth.value;
    sParams.scale = Scale.value;
    sParams.samplesPerNode = SamplesPerNode.value;
    sParams.pointWeight = PointWeight.value;
    sParams.perLevelDataScaleFactor = DataX.value;
    sParams.iters = Iters.value;
    sParams.verbose = Verbose.set;

    const unsigned int FEMSignature = FEMDegreeAndBType< 2, BOUNDARY_NEUMANN >::Signature;
    using Solver = Reconstructor::Poisson::Solver< Real , Dim , IsotropicUIntPack< Dim, FEMSignature > >;

    struct _InputOrientedSampleStream : public Reconstructor::InputOrientedSampleStream< Real , Dim > {
        decltype(pointStream)& _pointStream;
        Sample _scratch;
        _InputOrientedSampleStream( decltype(pointStream)& s ) : _pointStream(s){}
        void reset(void){ _pointStream.reset(); }
        bool read( Reconstructor::Position<Real,Dim>& p , Reconstructor::Normal<Real,Dim>& n ){
            bool ret = _pointStream.read(_scratch);
            if(ret) p=_scratch.template get<0>(), n=_scratch.template get<1>();
            return ret;
        }
    };
    _InputOrientedSampleStream sampleStream( pointStream );
    auto implicit = Solver::Solve( sampleStream , sParams );

    // --- 4. メッシュの抽出 ---
    Reconstructor::LevelSetExtractionParameters meParams;
    meParams.forceManifold = !NonManifold.set;

    using VInfo = Reconstructor::OutputVertexInfo< Real, Dim, false, false >;
    typename VInfo::Factory factory = VInfo::GetFactory();
    Reconstructor::OutputInputFactoryTypeStream< Real, Dim, typename VInfo::Factory, true, false > vertexStream( factory, VInfo::Convert );
    Reconstructor::OutputInputFaceStream< Dim-1, true, false > faceStream;
    implicit->extractLevelSet( vertexStream, faceStream, meParams );
    
    delete implicit;

    num_vertices = (int)vertexStream.size();
    num_faces = (int)faceStream.size();

    if( num_vertices==0 || num_faces==0 ) return nullptr;

    // --- 5. 結果をJavaScriptに返す ---
    float* result = (float*)malloc( ( sizeof(float)*3*num_vertices + sizeof(int)*3*num_faces ) );
    
    vertexStream.reset();
    Point< Real, Dim > v_data;
    for( int i=0; i<num_vertices; ++i)
    {
        vertexStream.read(v_data);
        result[i*3+0] = v_data.coords[0];
        result[i*3+1] = v_data.coords[1];
        result[i*3+2] = v_data.coords[2];
    }
    
    int* faces = (int*)(result + num_vertices * 3);
    faceStream.reset();
    
    // ★★★ ここが最後の修正点です ★★★
    // faceStream.read()は、1つの面(3つの頂点インデックスを持つvector)を
    // 引数として受け取り、そこにデータを書き込む仕様。
    
    // 1つの面のデータを受け取るためのvectorを定義
    std::vector<node_index_type> face_data; 
    
    for(int i=0; i<num_faces; ++i)
    {
        // readを呼び出して face_data に1面分のデータを読み込ませる
        if( faceStream.read(face_data) )
        {
            // vectorから各頂点インデックスを取り出してfaces配列に格納
            faces[i*3+0] = face_data[0];
            faces[i*3+1] = face_data[1];
            faces[i*3+2] = face_data[2];
        }
    }

    return result;
}

// Wasmモジュールとしてビルドするため、main関数は空にする
int main(){ return 0; }