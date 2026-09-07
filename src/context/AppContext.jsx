import { createContext, useContext, useReducer, useEffect } from "react";
import { generateProfiles } from "../data/profiles";

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
};

function generateLikesReceived(profiles, currentUser) {
  if (!currentUser) return [];
  const pool = profiles.filter((p) => p.gender !== currentUser.gender);
  const count = 6 + Math.floor(Math.random() * 6);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const comments = [
    "Love this!", "You seem amazing!", "This made me smile 😊",
    "We'd get along so well!", "Tell me more about this!",
    "Your faith journey is inspiring!", "I love your vibe ✨",
    "We have so much in common!", "This is exactly my type of person 🙏",
  ];
  return shuffled.slice(0, count).map((p) => ({
    fromId: p.id,
    type: Math.random() > 0.3 ? "like" : "comment",
    targetType: Math.random() > 0.5 ? "photo" : "prompt",
    targetIndex: 0,
    comment:
      Math.random() > 0.25
        ? comments[Math.floor(Math.random() * comments.length)]
        : null,
    timestamp: Date.now() - Math.floor(Math.random() * 86400000),
    isDove: Math.random() < 0.15,
  }));
}

function reducer(state, action) {
  switch (action.type) {
    case "COMPLETE_ONBOARDING":
      return {
        ...state,
        currentUser: action.payload,
        onboardingComplete: true,
        likesReceived: generateLikesReceived(state.profiles, action.payload),
      };

    case "SET_PROFILES":
      return { ...state, profiles: action.payload };

    case "LIKE_PROFILE": {
      const { profileId, targetType, targetIndex, comment, isDove } = action.payload;
      const newLike = {
        profileId,
        targetType,
        targetIndex,
        comment,
        isDove,
        timestamp: Date.now(),
      };

      const isMatch = state.likesReceived.some((l) => l.fromId === profileId);
      let newMatches = state.matches;
      let newConversations = state.conversations;

      if (isMatch) {
        const profile = state.profiles.find((p) => p.id === profileId);
        newMatches = [
          ...state.matches,
          {
            profileId,
            timestamp: Date.now(),
            profile,
          },
        ];
        newConversations = {
          ...state.conversations,
          [profileId]: {
            messages: [],
            lastActivity: Date.now(),
          },
        };
      }

      return {
        ...state,
        likes: [...state.likes, newLike],
        matches: newMatches,
        conversations: newConversations,
        currentProfileIndex: state.currentProfileIndex + 1,
        doves: isDove ? state.doves - 1 : state.doves,
      };
    }

    case "SKIP_PROFILE":
      return { ...state, currentProfileIndex: state.currentProfileIndex + 1 };

    case "MATCH_FROM_LIKES": {
      const { profileId } = action.payload;
      const profile = state.profiles.find((p) => p.id === profileId);
      return {
        ...state,
        matches: [...state.matches, { profileId, timestamp: Date.now(), profile }],
        conversations: {
          ...state.conversations,
          [profileId]: { messages: [], lastActivity: Date.now() },
        },
        likesReceived: state.likesReceived.filter((l) => l.fromId !== profileId),
      };
    }

    case "DISMISS_LIKE":
      return {
        ...state,
        likesReceived: state.likesReceived.filter((l) => l.fromId !== action.payload),
      };

    case "SEND_MESSAGE": {
      const { profileId, text } = action.payload;
      const convo = state.conversations[profileId] || { messages: [] };
      const newMessage = {
        id: `msg_${Date.now()}`,
        text,
        sender: "me",
        timestamp: Date.now(),
      };
      const updatedConvo = {
        messages: [...convo.messages, newMessage],
        lastActivity: Date.now(),
      };

      setTimeout(() => {
        const replies = [
          "Haha that's so sweet! 😊",
          "I was just thinking about you!",
          "Omg yes! When are you free?",
          "That sounds amazing, tell me more!",
          "You're making me blush 🙈",
          "I'd love that! What about this weekend?",
          "Aww you're too kind 💕",
          "That's exactly what I was hoping you'd say!",
        ];
        const reply = replies[Math.floor(Math.random() * replies.length)];
        action.dispatch({
          type: "RECEIVE_MESSAGE",
          payload: { profileId, text: reply },
        });
      }, 1500 + Math.random() * 3000);

      return {
        ...state,
        conversations: { ...state.conversations, [profileId]: updatedConvo },
      };
    }

    case "RECEIVE_MESSAGE": {
      const { profileId, text } = action.payload;
      const convo = state.conversations[profileId] || { messages: [] };
      const newMessage = {
        id: `msg_${Date.now()}`,
        text,
        sender: profileId,
        timestamp: Date.now(),
      };
      return {
        ...state,
        conversations: {
          ...state.conversations,
          [profileId]: {
            messages: [...convo.messages, newMessage],
            lastActivity: Date.now(),
          },
        },
      };
    }

    case "SET_TAB":
      return { ...state, activeTab: action.payload };

    case "UPDATE_FILTERS":
      return { ...state, filters: { ...state.filters, ...action.payload } };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const profiles = generateProfiles(40);
    dispatch({ type: "SET_PROFILES", payload: profiles });
  }, []);

  const wrappedDispatch = (action) => {
    if (action.type === "SEND_MESSAGE") {
      dispatch({ ...action, payload: { ...action.payload, dispatch: wrappedDispatch } });
    } else {
      dispatch(action);
    }
  };

  return (
    <AppContext.Provider value={{ state, dispatch: wrappedDispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
