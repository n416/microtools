#include "Reconstructors.h"
#include "FEMTree.h"

// test5.cppで使われているSolverのテンプレート実装を強制的に生成させる
using Real = float;
const unsigned int Dim = 3;
using FEMSig = PoissonRecon::IsotropicUIntPack<Dim, PoissonRecon::FEMDegreeAndBType<2, PoissonRecon::BOUNDARY_NEUMANN>::Signature>;

template class PoissonRecon::Reconstructor::Poisson::Solver<Real, Dim, FEMSig>;