import { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import * as api from "../services/api";

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
  filters: {
    maxAge: 35,
    maxDistance: 80,
  },
  onboardingComplete: false,
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
      };

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

    case "SET_LOADING":
      return { ...state, loading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "LOGOUT":
      api.clearToken();
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

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.getMe()
        .then((user) => {
          dispatch({ type: "SET_USER", payload: user });
        })
        .catch(() => {
          api.clearToken();
        });
    }
  }, []);

  useEffect(() => {
    if (state.onboardingComplete && state.currentUser) {
      loadDiscover();
      loadLikesReceived();
      loadMatches();
    }
  }, [state.onboardingComplete, state.currentUser]);

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
    register: async (data) => {
      const user = await api.register(data);
      dispatch({ type: "COMPLETE_ONBOARDING", payload: user });
      return user;
    },

    login: async (email, password) => {
      const user = await api.login(email, password);
      dispatch({ type: "SET_USER", payload: user });
      return user;
    },

    updateProfile: async (data) => {
      const profile = await api.updateProfile(data);
      dispatch({ type: "SET_USER", payload: profile });
      return profile;
    },

    likeProfile: async (profileId, targetType, targetIndex, comment, isDove) => {
      const res = await api.sendLike(profileId, targetType, targetIndex, comment, isDove);
      let matchData = null;
      if (res.matched) {
        const matches = await api.getMatches();
        dispatch({ type: "SET_MATCHES", payload: matches });
        matchData = matches.find((m) => m.profileId === profileId) || null;
      }
      dispatch({
        type: "LIKE_PROFILE",
        payload: { profileId, matched: res.matched, matchData, isDove },
      });
      return res;
    },

    skipProfile: async (profileId) => {
      await api.skipProfile(profileId);
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
        const matches = await api.getMatches();
        dispatch({ type: "SET_MATCHES", payload: matches });
        const matchData = matches.find((m) => m.profileId === like.fromId);
        dispatch({ type: "MATCH_FROM_LIKES", payload: { like, matchData } });
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
      dispatch({ type: "ADD_MESSAGE", payload: { matchId, message } });
      return message;
    },

    unmatch: async (matchId) => {
      await api.unmatch(matchId);
      dispatch({ type: "REMOVE_MATCH", payload: matchId });
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
