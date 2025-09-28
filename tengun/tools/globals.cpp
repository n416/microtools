#include "CmdLineParser.h"
#include "Reconstructors.h"

// 修正点1：必須である名前空間を指定
using namespace PoissonRecon;

// 修正点2：必須であるコンストラクタ引数（パラメータ名）をすべて追加
CmdLineParameter< char* > In( "in" );
CmdLineParameter< char* > Out( "out" );
CmdLineParameter< int > Degree( "degree" , Reconstructor::Poisson::DefaultFEMDegree );
CmdLineParameter< int > Depth( "depth" );
CmdLineParameter< int > BType( "bType" , Reconstructor::Poisson::DefaultFEMBoundary+1 );
CmdLineParameter< float > Scale( "scale" );
CmdLineParameter< float > SamplesPerNode( "samplesPerNode" );
CmdLineParameter< float > PointWeight( "pointWeight" );
CmdLineParameter< int > Iters( "iters" );
CmdLineReadable NonManifold( "nonManifold" );
CmdLineReadable Verbose( "verbose" );
CmdLineParameter< int > KernelDepth( "kernelDepth" );
CmdLineParameter< int > FullDepth( "fullDepth" );
CmdLineParameter< float > DataX( "data" );