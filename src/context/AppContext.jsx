import { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import * as api from "../services/api";
import { supabase } from "../services/supabase";
import { getSubscriptionStatus } from "../services/stripe";
import { syncPushSubscription } from "../services/push";
import { identify, track, reset as resetPosthog } from "../services/posthog";

const AppContext = createContext();

const initialState = {
  currentUser: null,
  profiles: [],
  currentProfileIndex: 0,
  likes: [],
  likesReceived: [],
  matches: [],
  conversations: {},
  doves: 3,
  blocked: [],
  reports: [],
  filters: {
    minAge: 18,
    maxAge: 35,
    maxDistance: 80,
    denominations: [],
  },
  onboardingComplete: false,
  needsProfile: false,
  passwordRecovery: false,
  activeTab: "discover",
  loading: false,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_USER":
      return {
        ...state,
        currentUser: action.payload,
        onboardingComplete: !!action.payload,
        needsProfile: false,
      };

    // Signed in (e.g. via Google/Apple) but the profile row was never created — resume onboarding
    case "NEEDS_PROFILE":
      return { ...state, needsProfile: true, currentUser: null, onboardingComplete: false };

    case "SET_RECOVERY":
      return { ...state, passwordRecovery: action.payload };

    case "COMPLETE_ONBOARDING":
      return {
        ...state,
        currentUser: action.payload,
        onboardingComplete: true,
      };

    case "SET_PROFILES":
      return { ...state, profiles: action.payload, currentProfileIndex: 0 };

    case "SET_LIKES_RECEIVED":
      return { ...state, likesReceived: action.payload };

    case "SET_MATCHES":
      return { ...state, matches: action.payload };

    case "NEXT_PROFILE":
      return { ...state, currentProfileIndex: state.currentProfileIndex + 1 };

    case "LIKE_PROFILE": {
      return {
        ...state,
        likes: [...state.likes, { profileId: action.payload.profileId, timestamp: Date.now() }],
        currentProfileIndex: state.currentProfileIndex + 1,
        doves: action.payload.isDove ? state.doves - 1 : state.doves,
      };
    }

    case "SKIP_PROFILE":
      return { ...state, currentProfileIndex: state.currentProfileIndex + 1 };

    case "MATCH_FROM_LIKES": {
      const { like } = action.payload;
      return {
        ...state,
        likesReceived: state.likesReceived.filter((l) => l.id !== like.id),
      };
    }

    case "DISMISS_LIKE":
      return {
        ...state,
        likesReceived: state.likesReceived.filter((l) => l.id !== action.payload),
      };

    case "SET_CONVERSATIONS":
      return {
        ...state,
        conversations: { ...state.conversations, ...action.payload },
      };

    case "ADD_MESSAGE": {
      const { matchId, message } = action.payload;
      const convo = state.conversations[matchId] || { messages: [] };
      return {
        ...state,
        conversations: {
          ...state.conversations,
          [matchId]: {
            messages: [...convo.messages, message],
            lastActivity: Date.now(),
          },
        },
      };
    }

    case "SET_TAB":
      return { ...state, activeTab: action.payload };

    case "UPDATE_FILTERS":
      return { ...state, filters: { ...state.filters, ...action.payload } };

    case "SET_USER_LOCATION":
      return {
        ...state,
        currentUser: {
          ...state.currentUser,
          location: { ...state.currentUser?.location, ...action.payload },
        },
      };

    case "BLOCK_PROFILE":
      return { ...state, blocked: [...state.blocked, typeof action.payload === "string" ? { id: action.payload } : action.payload] };

    case "UNBLOCK_PROFILE":
      return { ...state, blocked: state.blocked.filter((b) => (b.id || b) !== action.payload) };

    case "ADD_REPORT":
      return { ...state, reports: [...(state.reports || []), action.payload] };

    case "SET_LOADING":
      return { ...state, loading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "LOGOUT":
      return { ...initialState };

    case "REMOVE_MATCH":
      return {
        ...state,
        matches: state.matches.filter((m) => m.id !== action.payload),
      };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // The DB is updated by the Stripe webhook, which can lag — ask Stripe directly when the DB says not active
  const withStripeFallback = async (user) => {
    if (user.subscriptionStatus !== "active") {
      const stripeStatus = await getSubscriptionStatus().catch(() => null);
      if (stripeStatus?.status === "active") {
        user.subscriptionStatus = "active";
        track("subscription_activated");
      }
    }
    return user;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("subscription")) {
      track("subscription_checkout_returned", { result: params.get("subscription") });
    }
    if (params.get("tab")) dispatch({ type: "SET_TAB", payload: params.get("tab") });
    if (params.has("subscription") || params.has("tab")) window.history.replaceState({}, "", window.location.pathname);

    // A tapped notification hands us its target URL while the app is already open
    const onSwMessage = (e) => {
      if (e.data?.type !== "open") return;
      const tab = new URL(e.data.url, window.location.origin).searchParams.get("tab");
      if (tab) dispatch({ type: "SET_TAB", payload: tab });
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);

    const oauthReturn = /access_token=|code=|type=recovery/.test(window.location.hash + window.location.search);

    const loadSessionUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const exists = await api.checkProfileExists();
        if (!exists) { dispatch({ type: "NEEDS_PROFILE" }); return; }
        const user = await withStripeFallback(await api.getMe());
        dispatch({ type: "SET_USER", payload: user });
        identify(user.id, { name: user.name, email: user.email, gender: user.gender, denomination: user.denomination, location: user.location?.city, subscriptionStatus: user.subscriptionStatus });
      } catch (_) {}
    };
    loadSessionUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        dispatch({ type: "LOGOUT" });
        resetPosthog();
      }
      if (event === "PASSWORD_RECOVERY") dispatch({ type: "SET_RECOVERY", payload: true });
      // Returning from Google/Apple: the session arrives after the first getSession()
      if (event === "SIGNED_IN" && oauthReturn) {
        window.history.replaceState({}, "", window.location.pathname);
        setTimeout(loadSessionUser, 0);
      }
    });

    return () => {
      subscription.unsubscribe();
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };
  }, []);

  useEffect(() => {
    if (state.onboardingComplete && state.currentUser) {
      syncPushSubscription();
      loadDiscover();
      loadLikesReceived();
      loadMatches();
      const poll = setInterval(() => {
        loadLikesReceived();
        loadMatches();
      }, 10000);
      const refreshProfile = async () => {
        if (document.visibilityState === "visible") {
          try {
            const user = await withStripeFallback(await api.getMe());
            dispatch({ type: "SET_USER", payload: user });
          } catch (_) {}
        }
      };
      document.addEventListener("visibilitychange", refreshProfile);
      return () => { clearInterval(poll); document.removeEventListener("visibilitychange", refreshProfile); };
    }
  }, [state.onboardingComplete, state.currentUser?.id]);

  useEffect(() => {
    if (state.currentUser && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          dispatch({
            type: "SET_USER_LOCATION",
            payload: { lat, lng },
          });
          try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`);
            const data = await resp.json();
            const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || "";
            if (city) {
              dispatch({ type: "SET_USER_LOCATION", payload: { lat, lng, city } });
              api.updateProfile({ location: city }).catch(() => {});
            }
          } catch (_) {}
        },
        () => {}
      );
    }
  }, [state.currentUser?.id]);

  const loadDiscover = useCallback(async () => {
    try {
      const profiles = await api.getDiscover();
      dispatch({ type: "SET_PROFILES", payload: profiles });
    } catch (err) {
      console.error("Failed to load discover:", err);
    }
  }, []);

  const loadLikesReceived = useCallback(async () => {
    try {
      const likes = await api.getLikesReceived();
      dispatch({ type: "SET_LIKES_RECEIVED", payload: likes });
    } catch (err) {
      console.error("Failed to load likes:", err);
    }
  }, []);

  const loadMatches = useCallback(async () => {
    try {
      const matches = await api.getMatches();
      dispatch({ type: "SET_MATCHES", payload: matches });
    } catch (err) {
      console.error("Failed to load matches:", err);
    }
  }, []);

  const actions = {
    sendOtp: async (phone) => {
      return api.sendOtp(phone);
    },

    verifyOtp: async (phone, token) => {
      const result = await api.verifyOtp(phone, token);
      const hasProfile = await api.checkProfileExists();
      if (hasProfile) {
        const user = await api.getMe();
        dispatch({ type: "SET_USER", payload: user });
        return { isNewUser: false };
      }
      return { isNewUser: true };
    },

    setPassword: async (password) => {
      return api.setPassword(password);
    },

    verifyOtpForReset: async (phone, token) => {
      return api.verifyOtp(phone, token);
    },

    loginWithEmail: async (email, password) => {
      const user = await api.signInWithEmail(email, password);
      if (!user) {
        track("login_needs_profile");
        return { needsProfile: true };
      }
      dispatch({ type: "SET_USER", payload: user });
      identify(user.id, { name: user.name, email: user.email, gender: user.gender, subscriptionStatus: user.subscriptionStatus });
      track("login", { method: "email" });
      return user;
    },

    signUpWithEmail: async (email, password) => {
      const res = await api.signUpWithEmail(email, password);
      track("signup_email_started", { confirmed: res.confirmed });
      return res;
    },

    signInWithProvider: async (provider) => {
      track("oauth_started", { provider });
      await api.signInWithProvider(provider);
    },

    sendPasswordResetEmail: (email) => api.sendPasswordResetEmail(email),
    getSessionUser: () => api.getSessionUser(),
    clearRecovery: () => dispatch({ type: "SET_RECOVERY", payload: false }),

    completePasswordReset: async (password) => {
      await api.setPassword(password);
      const user = await withStripeFallback(await api.getMe());
      dispatch({ type: "SET_USER", payload: user });
      identify(user.id, { name: user.name, email: user.email, gender: user.gender, subscriptionStatus: user.subscriptionStatus });
      return user;
    },

    register: async (data) => {
      const user = await api.createProfile(data);
      dispatch({ type: "COMPLETE_ONBOARDING", payload: user });
      identify(user.id, { name: user.name, email: user.email, gender: user.gender, denomination: user.denomination });
      track("signup_completed", { gender: user.gender, denomination: user.denomination });
      return user;
    },

    loginWithPhone: async (phone, password) => {
      const user = await api.loginWithPhone(phone, password);
      if (!user) {
        track("login_needs_profile");
        return { needsProfile: true };
      }
      dispatch({ type: "SET_USER", payload: user });
      identify(user.id, { name: user.name, email: user.email, gender: user.gender, subscriptionStatus: user.subscriptionStatus });
      track("login", { method: "phone" });
      return user;
    },

    login: async (email, password) => {
      const user = await api.login(email, password);
      dispatch({ type: "SET_USER", payload: user });
      identify(user.id, { name: user.name, email: user.email, gender: user.gender, subscriptionStatus: user.subscriptionStatus });
      track("login", { method: "email" });
      return user;
    },

    updateProfile: async (data) => {
      const profile = await api.updateProfile(data);
      dispatch({ type: "SET_USER", payload: profile });
      return profile;
    },

    likeProfile: async (profileId, targetType, targetIndex, comment, isDove) => {
      const res = await api.sendLike(profileId, targetType, targetIndex, comment, isDove);
      track("like_sent", { targetType, isDove: !!isDove, hasComment: !!comment });
      let matchData = null;
      if (res.matched) {
        track("match_created", { fromDiscover: true });
        const matches = await api.getMatches();
        dispatch({ type: "SET_MATCHES", payload: matches });
        matchData = matches.find((m) => m.profileId === profileId) || null;
        api.notifyUser(profileId, { title: "It's a match", body: `You and ${state.currentUser?.name || "someone"} liked each other. Time to plan a date.`, url: "/?tab=matches", tag: "match" });
      } else {
        api.notifyUser(profileId, { title: isDove ? "You received a Dove" : "Someone new likes you", body: "Open Sparks to see who.", url: "/?tab=likes", tag: "like" });
      }
      dispatch({
        type: "LIKE_PROFILE",
        payload: { profileId, matched: res.matched, matchData, isDove },
      });
      return res;
    },

    skipProfile: async (profileId) => {
      await api.skipProfile(profileId);
      track("profile_skipped");
      dispatch({ type: "SKIP_PROFILE" });
    },

    matchFromLike: async (like) => {
      let res;
      try {
        res = await api.sendLike(like.fromId, "profile", 0);
      } catch (err) {
        if (err.message === "Already liked") {
          res = { matched: true };
        } else {
          throw err;
        }
      }
      if (res.matched) {
        track("match_created", { fromSparks: true });
        api.notifyUser(like.fromId, { title: "It's a match", body: `${state.currentUser?.name || "Someone"} liked you back. Time to plan a date.`, url: "/?tab=matches", tag: "match" });
        const alreadyMatched = state.matches.some(
          (m) => m.profileId === like.fromId
        );
        if (!alreadyMatched) {
          const newMatch = {
            id: res.matchId || `temp-${Date.now()}`,
            profileId: like.fromId,
            profile: like.profile,
            timestamp: Date.now(),
            lastMessage: like.comment ? { text: like.comment, sender: like.fromId, timestamp: Date.now() } : null,
          };
          dispatch({ type: "SET_MATCHES", payload: [...state.matches, newMatch] });
        }
        dispatch({ type: "MATCH_FROM_LIKES", payload: { like, matchData: null } });
      }
      return res;
    },

    dismissLike: async (likeId) => {
      await api.dismissLike(likeId);
      dispatch({ type: "DISMISS_LIKE", payload: likeId });
    },

    loadMessages: async (matchId) => {
      const messages = await api.getMessages(matchId);
      dispatch({
        type: "SET_CONVERSATIONS",
        payload: { [matchId]: { messages, lastActivity: Date.now() } },
      });
    },

    sendMessage: async (matchId, text) => {
      const message = await api.sendMessage(matchId, text);
      track("message_sent");
      dispatch({ type: "ADD_MESSAGE", payload: { matchId, message } });
      const m = state.matches.find((x) => x.id === matchId);
      if (m?.profileId) {
        api.notifyUser(m.profileId, { title: state.currentUser?.name || "New message", body: text.slice(0, 120), url: "/?tab=matches", tag: `msg-${matchId}` });
      }
      return message;
    },

    unmatch: async (matchId) => {
      await api.unmatch(matchId);
      track("unmatch");
      dispatch({ type: "REMOVE_MATCH", payload: matchId });
    },

    logout: async () => {
      await supabase.auth.signOut();
    },

    refreshDiscover: loadDiscover,
    refreshLikes: loadLikesReceived,
    refreshMatches: loadMatches,
  };

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
