#ifndef MY_EXCEPTIONS_INCLUDED
#define MY_EXCEPTIONS_INCLUDED
#include <string>
#include <sstream>
#include <iostream>
#include <cstdlib> // abort() のために追加

// 複数の引数を安全に文字列に変換するための補助関数
template< typename ... Args >
std::string MakeMessage( Args ... args )
{
    std::stringstream ss;
    ( ss << ... << args );
    return ss.str();
}

// ★★★ これが最重要の修正 ★★★
// 例外をthrowするのではなく、メッセージをコンソールに出力して強制終了する
#define MK_THROW( ... ) \
	do \
	{ \
		std::cerr << "[FATAL ERROR] " << MakeMessage( __VA_ARGS__ ) << std::endl; \
		abort(); \
	} \
	while(0)


// 警告も同様に、安全な方法で出力する
#define MK_WARN( ... ) std::cerr << "[WARNING] " << MakeMessage( __VA_ARGS__ ) << std::endl

#define MK_WARN_ONCE( ... ) \
	do \
	{ \
		static bool __warned = false; \
		if( !__warned ) \
		{ \
			MK_WARN( __VA_ARGS__ ); \
			__warned = true; \
		} \
	} \
	while(0)

#endif // MY_EXCEPTIONS_INCLUDED