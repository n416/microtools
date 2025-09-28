#ifndef MULTI_THREADING_INCLUDED
#define MULTI_THREADING_INCLUDED
#include <vector>
#include <string>
#include <functional>

// ==================================================================================
// このファイルは、mkazhdan/PoissonRecon のマルチスレッド機能を完全に無効化し、
// すべての処理をシングルスレッドで実行するための、最終確定版です。
// ==================================================================================

namespace ThreadPool
{
	enum ScheduleType { STATIC, DYNAMIC };
	static const std::vector< std::string > ScheduleNames = { "static" , "dynamic" };
	enum ParallelType { NONE, OMP };
	static const std::vector< std::string > ParallelNames = { "none" , "OpenMP" };

	static int ChunkSize = 1;
	static ScheduleType Schedule = STATIC;
	static ParallelType ParallelizationType = NONE;
	static int ThreadCount = 1;

	// すべての並列実行関数を、単純なforループに置き換えます
	template< class Functor >
	void ParallelFor( size_t begin , size_t end , Functor f ){ for( size_t i=begin ; i<end ; i++ ) f( (unsigned int)0 , i ); }

	template< class Functor >
	void Run( Functor f , size_t count ){ for( size_t i=0 ; i<count ; i++ ) f( (unsigned int)0 , i ); }

    // 可変個引数テンプレートを使用して、すべてのParallelSections呼び出しを単一の関数呼び出しに置き換えます
	template< class ... Functors >
	void ParallelSections( Functors ... fs )
	{
		// 可変個の関数を順番に実行するダミー実装
		( (void)fs() , ... );
	}

	// 初期化・終了処理は空にします
	inline void Init( ParallelType p=OMP , int threads=0 ){}
	inline void Terminate( void ){}

	// 常に1スレッドと報告します
	inline int GetThreads( void ){ return 1; }
    inline int NumThreads(void) { return 1; }
	inline void SetThreads( int threads=0 ) {}

	class Profile{};
	class AtomicValue
	{
		int _val;
	public:
		AtomicValue( void ) : _val(0){ }
		int operator ++ ( void ) { return ++_val; }
		operator int ( void ) const { return _val; }
	};
}
#endif //MULTI_THREADING_INCLUDED