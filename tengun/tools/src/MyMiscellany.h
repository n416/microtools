#ifndef MY_MISCELLANY_INCLUDED
#define MY_MISCELLANY_INCLUDED

#include <iostream>
#include <sstream>
#include <filesystem>
#include <string.h>
#include <sys/timeb.h>
#include <cstdio>
#include <ctime>
#include <chrono>
// ★ EMSCRIPTEN環境では thread と mutex をインクルードしない
#ifndef __EMSCRIPTEN__
#include <thread>
#include <mutex>
#endif // __EMSCRIPTEN__

#if defined( _WIN32 ) || defined( _WIN64 )
#include <io.h>
#include <Windows.h>
#include <Psapi.h>
#else // !_WIN32 && !_WIN64
#include <unistd.h>
#include <sys/time.h> 
#include <sys/resource.h> 
#endif // _WIN32 || _WIN64
#include <memory>
#if defined(_WIN32) || defined( _WIN64 )
#elif defined(__unix__) || defined(__unix) || defined(unix) || (defined(__APPLE__) && defined(__MACH__))
#if defined(__APPLE__) && defined(__MACH__)
#include <mach/mach.h>
#elif (defined(_AIX) || defined(__TOS__AIX__)) || (defined(__sun__) || defined(__sun) || defined(sun) && (defined(__SVR4) || defined(__svr4__)))
#include <fcntl.h>
#include <procfs.h>
#elif defined(__linux__) || defined(__linux) || defined(linux) || defined(__gnu_linux__)
#include <stdio.h>
#endif

#else
#error "Cannot define getPeakRSS( ) or getCurrentRSS( ) for an unknown OS."
#endif
#include "Array.h"
#include "MyAtomic.h"
#include "MultiThreading.h"

namespace PoissonRecon
{
	////////////////////////////
	// Formatted float output //
	////////////////////////////
	struct StreamFloatPrecision
	{
		StreamFloatPrecision( std::ostream &str , unsigned int precision , bool scientific=false ) : _str(str)
		{
			_defaultPrecision = (int)_str.precision();
			_str.precision( precision );
			if( scientific ) _str << std::scientific;
			else             _str << std::fixed;
		}
		~StreamFloatPrecision( void )
		{
			_str << std::defaultfloat;
			_str.precision( _defaultPrecision );
		}
	protected:
		int _defaultPrecision;
		std::ostream &_str;
	};

	////////////////
	// Time Stuff //
	////////////////
	inline double Time( void )
	{
#ifdef WIN32
		struct _timeb t;
		_ftime( &t );
		return double( t.time ) + double( t.millitm ) / 1000.0;
#else // WIN32
		struct timeval t;
		gettimeofday( &t , NULL );
		return t.tv_sec + double( t.tv_usec ) / 1000000;
#endif // WIN32
	}

	struct Timer
	{
		Timer( void ){ _startCPUClock = std::clock() , _startWallClock = std::chrono::system_clock::now(); }
		double cpuTime( void ) const{ return (std::clock() - _startCPUClock) / (double)CLOCKS_PER_SEC; };
		double wallTime( void ) const{ std::chrono::duration<double> diff = (std::chrono::system_clock::now() - _startWallClock) ; return diff.count(); }
		std::string operator()( bool showCpuTime , unsigned int precision=1 ) const
		{
			std::stringstream ss;
			StreamFloatPrecision sfp( ss , precision );
			ss << wallTime() << " (s)";
			if( showCpuTime ) ss << " / " << cpuTime() << " (s)";
			return ss.str();
		}
		friend std::ostream &operator << ( std::ostream &os , const Timer &timer ){ return os << timer(false); }
	protected:
		std::clock_t _startCPUClock;
		std::chrono::time_point< std::chrono::system_clock > _startWallClock;
	};

	///////////////
	// I/O Stuff //
	///////////////
#if defined( _WIN32 ) || defined( _WIN64 )
	const char FileSeparator = '\\';
#else // !_WIN
	const char FileSeparator = '/';
#endif // _WIN

#ifndef SetTempDirectory
#if defined( _WIN32 ) || defined( _WIN64 )
#define SetTempDirectory( tempDir , sz ) GetTempPath( (sz) , (tempDir) )
#else // !_WIN32 && !_WIN64
#define SetTempDirectory( tempDir , sz ) if( std::getenv( "TMPDIR" ) ) strcpy( tempDir , std::getenv( "TMPDIR" ) );
#endif // _WIN32 || _WIN64
#endif // !SetTempDirectory

#if defined( _WIN32 ) || defined( _WIN64 )
	inline void FSync( FILE *fp )
	{
		// 	FlushFileBuffers( (HANDLE)_fileno( fp ) );
		_commit( _fileno( fp ) );
	}
#else // !_WIN32 && !_WIN64
	inline void FSync( FILE *fp )
	{
		fsync( fileno( fp ) );
	}
#endif // _WIN32 || _WIN64

	//////////////////
	// Memory Stuff //
	//////////////////
	size_t getPeakRSS( void );
	size_t getCurrentRSS( void );

	struct Profiler
	{
		Profiler( unsigned int ms=0 )
		{
			_t = Time();
			_currentPeak = 0;
#ifndef __EMSCRIPTEN__
			_terminate = false;
			if( ms )
			{
				_thread = std::thread( &Profiler::_updatePeakMemoryFunction , std::ref( *this ) , ms );
				_spawnedSampler = true;
			}
			else _spawnedSampler = false;
#else // __EMSCRIPTEN__
			_spawnedSampler = false;
#endif // __EMSCRIPTEN__
		}

		~Profiler( void )
		{
#ifndef __EMSCRIPTEN__
			if( _spawnedSampler )
			{
				_terminate = true;
				_thread.join();
			}
#endif // __EMSCRIPTEN__
		}

		void reset( void )
		{
			_t = Time();
#ifndef __EMSCRIPTEN__
			if( _spawnedSampler )
			{
				std::lock_guard< std::mutex > lock( _mutex );
				_currentPeak = 0;
			}
			else _currentPeak = 0;
#else // __EMSCRIPTEN__
			_currentPeak = 0;
#endif // __EMSCRIPTEN__
		}

		void update( void )
		{
			size_t currentPeak = getCurrentRSS();
#ifndef __EMSCRIPTEN__
			if( _spawnedSampler )
			{
				std::lock_guard< std::mutex > lock( _mutex );
				if( currentPeak>_currentPeak ) _currentPeak = currentPeak;
			}
			else if( currentPeak>_currentPeak ) _currentPeak = currentPeak;
#else // __EMSCRIPTEN__
			if( currentPeak>_currentPeak ) _currentPeak = currentPeak;
#endif // __EMSCRIPTEN__
		}

		std::string operator()( bool showTime=true ) const
		{
			std::stringstream ss;
			double dt = Time()-_t;
			double 	localPeakMB = ( (double)_currentPeak )/(1<<20);
			double globalPeakMB = ( (double)getPeakRSS() )/(1<<20);
			{
				StreamFloatPrecision sfp( ss , 1 );
				if( showTime ) ss << dt << " (s), ";
				ss << localPeakMB << " (MB) / " << globalPeakMB << " (MB)";
			}
			return ss.str();
		}

		friend std::ostream &operator << ( std::ostream &os , const Profiler &profiler ){ return os << profiler(); }

	protected:
#ifndef __EMSCRIPTEN__
		std::thread _thread;
		std::mutex _mutex;
		std::atomic< bool > _terminate;
#endif // __EMSCRIPTEN__
		double _t;
		std::atomic< bool > _spawnedSampler;
		std::atomic< size_t > _currentPeak;


#ifndef __EMSCRIPTEN__
		void _updatePeakMemoryFunction( unsigned int ms )
		{
			while( true )
			{
				std::this_thread::sleep_for( std::chrono::milliseconds( ms ) );
				update();
				if( _terminate ) return;
			}
		};
#endif // __EMSCRIPTEN__
	};

	struct MemoryInfo
	{
		static size_t Usage( void ){ return getCurrentRSS(); }
		static int PeakMemoryUsageMB( void ){ return (int)( getPeakRSS()>>20 ); }
	};

#if defined( _WIN32 ) || defined( _WIN64 )
	inline void SetPeakMemoryMB( size_t sz )
	{
		sz <<= 20;
		SIZE_T peakMemory = sz;
		HANDLE h = CreateJobObject( NULL , NULL );
		AssignProcessToJobObject( h , GetCurrentProcess() );

		JOBOBOJECT_EXTENDED_LIMIT_INFORMATION jeli = { 0 };
		jeli.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_JOB_MEMORY;
		jeli.JobMemoryLimit = peakMemory;
		if( !SetInformationJobObject( h , JobObjectExtendedLimitInformation , &jeli , sizeof( jeli ) ) ) MK_WARN( "Failed to set memory limit" );
	}
#else // !_WIN32 && !_WIN64
	inline void SetPeakMemoryMB( size_t sz )
	{
		sz <<= 20;
		struct rlimit rl;
		getrlimit( RLIMIT_AS , &rl );
		rl.rlim_cur = sz;
		setrlimit( RLIMIT_AS , &rl );
	}
#endif // _WIN32 || _WIN64

	inline size_t getPeakRSS( )
	{
#if defined(__EMSCRIPTEN__)
		return 0;
#elif defined(_WIN32)
		PROCESS_MEMORY_COUNTERS info;
		GetProcessMemoryInfo( GetCurrentProcess( ), &info, sizeof(info) );
		return (size_t)info.PeakWorkingSetSize;
#elif (defined(_AIX) || defined(__TOS__AIX__)) || (defined(__sun__) || defined(__sun) || defined(sun) && (defined(__SVR4) || defined(__svr4__)))
		struct psinfo psinfo;
		int fd = -1;
		if ( (fd = open( "/proc/self/psinfo", O_RDONLY )) == -1 )
			return (size_t)0L;
		if ( read( fd, &psinfo, sizeof(psinfo) ) != sizeof(psinfo) )
		{
			close( fd );
			return (size_t)0L;
		}
		close( fd );
		return (size_t)(psinfo.pr_rssize * 1024L);
#elif defined(__unix__) || defined(__unix) || defined(unix) || (defined(__APPLE__) && defined(__MACH__))
		struct rusage rusage;
		getrusage( RUSAGE_SELF, &rusage );
#if defined(__APPLE__) && defined(__MACH__)
		return (size_t)rusage.ru_maxrss;
#else
		return (size_t)(rusage.ru_maxrss * 1024L);
#endif
#else
		return (size_t)0L;
#endif
	}

	inline size_t getCurrentRSS( )
	{
#if defined(__EMSCRIPTEN__)
		return 0;
#elif defined(_WIN32) || defined( _WIN64 )
		PROCESS_MEMORY_COUNTERS info;
		GetProcessMemoryInfo( GetCurrentProcess( ), &info, sizeof(info) );
		return (size_t)info.WorkingSetSize;
#elif defined(__APPLE__) && defined(__MACH__)
		struct mach_task_basic_info info;
		mach_msg_type_number_t infoCount = MACH_TASK_BASIC_INFO_COUNT;
		if ( task_info( mach_task_self( ), MACH_TASK_BASIC_INFO,
			(task_info_t)&info, &infoCount ) != KERN_SUCCESS )
			return (size_t)0L;
		return (size_t)info.resident_size;
#elif defined(__linux__) || defined(__linux) || defined(linux) || defined(__gnu_linux__)
		long rss = 0L;
		FILE* fp = NULL;
		if ( (fp = fopen( "/proc/self/statm", "r" )) == NULL )
			return (size_t)0L;
		if ( fscanf( fp, "%*s%ld", &rss ) != 1 )
		{
			fclose( fp );
			return (size_t)0L;
		}
		fclose( fp );
		return (size_t)rss * (size_t)sysconf( _SC_PAGESIZE);
#else
		return (size_t)0L;
#endif
	}
}

#endif // MY_MISCELLANY_INCLUDED