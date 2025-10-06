import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from './store'

// 型情報付きのuseDispatchフック
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
// 型情報付きのuseSelectorフック
export const useAppSelector = useSelector.withTypes<RootState>()