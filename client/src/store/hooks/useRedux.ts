/**
 * Redux Hooks
 * Typed hooks for use throughout the application
 */

import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';

/**
 * Typed useDispatch hook
 * Use throughout the app instead of plain useDispatch
 */
export const useAppDispatch = () => useDispatch<AppDispatch>();

/**
 * Typed useSelector hook
 * Use throughout the app instead of plain useSelector
 */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
