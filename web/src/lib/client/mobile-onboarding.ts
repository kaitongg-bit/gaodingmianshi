"use client";

export const MOBILE_SIGNUP_ELIGIBLE_KEY = "draftready_mobile_signup_eligible";
export const MOBILE_DESKTOP_NOTICE_SEEN_KEY = "draftready_mobile_desktop_notice_seen";
const NARROW_MOBILE_QUERY = "(max-width: 520px)";

export function isLikelyMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const narrowViewport = window.matchMedia("(max-width: 767px)").matches;
  return mobileUa || narrowViewport;
}

export function isNarrowMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(NARROW_MOBILE_QUERY).matches;
}

export function markMobileSignupEligible(): void {
  if (typeof window === "undefined") return;
  if (!isNarrowMobileViewport()) return;
  try {
    window.localStorage.setItem(MOBILE_SIGNUP_ELIGIBLE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isMobileSignupEligible(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MOBILE_SIGNUP_ELIGIBLE_KEY) === "1";
  } catch {
    return false;
  }
}

export function hasSeenMobileDesktopNotice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MOBILE_DESKTOP_NOTICE_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markMobileDesktopNoticeSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MOBILE_DESKTOP_NOTICE_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

