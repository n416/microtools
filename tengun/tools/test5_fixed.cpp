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

// グローバル変数のextern宣言
extern CmdLineParameter< char* > In;
extern CmdLineParameter< char* > Out;
extern CmdLineParameter< int > Degree;
extern CmdLineParameter< int > Depth;
extern CmdLineParameter< int > KernelDepth;
extern CmdLineParameter< int > FullDepth;
extern CmdLineParameter< int > BType;
extern CmdLineParameter< float > Scale;
extern CmdLineParameter< float > SamplesPerNode;
extern CmdLineParameter< float > PointWeight;
extern CmdLineParameter< float > DataX;
extern CmdLineParameter< int > Iters;
extern CmdLineReadable NonManifold;
extern CmdLineReadable Verbose;


template< class Real , unsigned int Dim , unsigned int FEMSig >
void Execute( void )
{
    using VFactory = VertexFactory::NormalFactory< Real , Dim >;
    using PFactory = VertexFactory::PositionFactory< Real , Dim >;
    using SampleFactory = VertexFactory::Factory< Real , PFactory, VFactory >;
    using Sample = typename SampleFactory::VertexType;

    std::vector< Sample > samples;

    // よりサーフェスとして認識しやすい12点のデータに変更
    double test_points[] = {
        // 底面 (z=0)
        0,0,0, 0,0,-1,
        1,0,0, 0,0,-1,
        1,1,0, 0,0,-1,
        0,1,0, 0,0,-1,
        // 天面 (z=1)
        0,0,1, 0,0,1,
        1,0,1, 0,0,1,
        1,1,1, 0,0,1,
        0,1,1, 0,0,1,
        // 側面 (x=0)
        0,0.5,0, -1,0,0,
        0,0.5,1, -1,0,0,
        // 側面 (x=1)
        1,0.5,0, 1,0,0,
        1,0.5,1, 1,0,0,
    };
    const int num_points = sizeof(test_points) / (sizeof(double) * 6);
    samples.resize(num_points);

    for( int i=0 ; i<num_points ; ++i )
    {
        samples[i].template get<0>().coords[0] = static_cast<Real>( test_points[i*6+0] );
        samples[i].template get<0>().coords[1] = static_cast<Real>( test_points[i*6+1] );
        samples[i].template get<0>().coords[2] = static_cast<Real>( test_points[i*6+2] );

        Real* n = samples[i].template get<1>().coords;
        n[0] = static_cast<Real>( test_points[i*6+3] );
        n[1] = static_cast<Real>( test_points[i*6+4] );
        n[2] = static_cast<Real>( test_points[i*6+5] );

        Real len = static_cast<Real>( std::sqrt( n[0]*n[0] + n[1]*n[1] + n[2]*n[2] ) );
        if( len > 0 ) for(int d=0; d<Dim; d++) n[d] /= len;
    }
    VectorBackedInputDataStream< Sample > pointStream( samples );

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

    using Solver = Reconstructor::Poisson::Solver< Real , Dim , IsotropicUIntPack< Dim, FEMSig > >;

    struct _InputOrientedSampleStream : public Reconstructor::InputOrientedSampleStream< Real , Dim >
    {
        decltype(pointStream)& _pointStream;
        Sample _scratch;
        _InputOrientedSampleStream( decltype(pointStream)& pointStream ) : _pointStream(pointStream){}
        void reset(void){ _pointStream.reset(); }
        bool read( Reconstructor::Position<Real,Dim>& p , Reconstructor::Normal<Real,Dim>& n )
        {
            bool ret = _pointStream.read( _scratch );
            if( ret ) p=_scratch.template get<0>() , n=_scratch.template get<1>();
            return ret;
        }
    };
    _InputOrientedSampleStream sampleStream( pointStream );

    auto implicit = Solver::Solve( sampleStream , sParams );

    Reconstructor::LevelSetExtractionParameters meParams;
    meParams.forceManifold = !NonManifold.set;

    using VInfo = Reconstructor::OutputVertexInfo< Real, Dim, false, false >;
    typename VInfo::Factory factory = VInfo::GetFactory();
    Reconstructor::OutputInputFactoryTypeStream< Real, Dim, typename VInfo::Factory, true, false > vertexStream( factory, VInfo::Convert );
    Reconstructor::OutputInputFaceStream< Dim-1, true, false > faceStream;
    implicit->extractLevelSet( vertexStream, faceStream, meParams );

    std::cout << "Reconstruction Complete!" << std::endl;
    std::cout << "  Vertex Count: " << vertexStream.size() << std::endl;
    std::cout << "  Face Count: " << faceStream.size() << std::endl;

    delete implicit;
}

int main() {
    ThreadPool::ParallelizationType = ThreadPool::NONE;

    // パラメータをPoissonRecon.cppのデフォルトに厳密に合わせる
    Depth.value = 6; // 少ない点群なので深度を少し下げる
    Depth.set = true;
    KernelDepth.value = Depth.value - 2; // 推奨される設定
    KernelDepth.set = true;
    FullDepth.value = 5;
    FullDepth.set = true;
    DataX.value = 32.f;
    DataX.set = true;
    Degree.value = 2;
    Degree.set = true;
    BType.value = BOUNDARY_NEUMANN + 1;
    BType.set = true;
    Scale.value = 1.1f;
    Scale.set = true;
    SamplesPerNode.value = 1.5f;
    SamplesPerNode.set = true;
    PointWeight.value = Reconstructor::Poisson::WeightMultiplier * Degree.value;
    PointWeight.set = true;
    Iters.value = 8;
    Iters.set = true;
    NonManifold.set = true;
    Verbose.set = true;

    std::cout << "Starting Poisson Reconstruction..." << std::endl;
    Execute< float, 3, FEMDegreeAndBType< 2, BOUNDARY_NEUMANN >::Signature >();
    std::cout << "Processing finished." << std::endl;

    return 0;
}