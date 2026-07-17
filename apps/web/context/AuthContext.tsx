import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/config/firebase";

// helpers
import { api } from "@/lib/api/client";

// components
import Loader from "@/components/Loader";

// route
import { useRouter } from "next/navigation";

// constants
import { Audio, Collection, User } from "@/constants/interfaces";

const AuthContext = createContext<any>({});

export const useAuth = () => useContext(AuthContext);

export const AuthContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const router = useRouter();

  const [user, setUser] = useState<User>({
    ID: "",
    docID: "",
    avatar: "",
    userName: "",
    email: "",
    marketingEmails: false,
    lovedSongs: [],
    collections: [],
    lovedCollections: [],
    followers: [],
    following: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true); // Set loading to true when authentication state changes
      try {
        if (mounted && firebaseUser) {
          await getUser(firebaseUser.uid);
        } else if (mounted && !firebaseUser) {
          // Only reset user if no Firebase user is present
          setUser({
            ID: "",
            docID: "",
            avatar: "",
            userName: "",
            email: "",
            marketingEmails: false,
            lovedSongs: [],
            collections: [],
            lovedCollections: [],
            followers: [],
            following: [],
          });
        }
      } catch (error) {
        console.error("Auth state handling failed:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      mounted = false;
    };
  }, []);

  const signup = (
    email: string,
    password: string,
    avatar: string,
    name: string
  ) => {
    return createUserWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
        const fbUser = userCredential.user;
        const userData = {
          ID: fbUser.uid,
          userName: fbUser.displayName ? fbUser.displayName : name,
          email: fbUser.email,
          avatar: avatar,
          marketingEmails: false,
          collections: [],
          lovedSongs: [],
          lovedCollections: [],
          followers: [],
          following: [],
        };
        await api.ensureMe(userData);
        router.push(`/profile/${fbUser.uid}`);
      })
      .catch((error) => {
        throw new Error(error.code);
      });
  };

  // avatar = https://api.dicebear.com/5.x/lorelei/svg?seed=A

  const signupPopup = async (prov: string) => {
    const provider =
      prov === "facebook"
        ? new FacebookAuthProvider()
        : new GoogleAuthProvider();

    return signInWithPopup(auth, provider)
      .then(async (result) => {
        const fbUser = result.user;
        const userData = {
          ID: fbUser.uid,
          userName: fbUser.displayName,
          email: fbUser.email,
          avatar: fbUser.photoURL,
          marketingEmails: false,
          collections: [],
          lovedSongs: [],
          lovedCollections: [],
          followers: [],
          following: [],
        };
        await api.ensureMe(userData);
        router.push(`/profile/${fbUser.uid}`);
      })
      .catch((error) => {
        throw new Error(error.code);
      });
  };

  const signinPopup = async (prov: string) => {
    const provider =
      prov === "facebook"
        ? new FacebookAuthProvider()
        : new GoogleAuthProvider();
    return signInWithPopup(auth, provider)
      .then(async (userCredential) => {
        const fbUser = userCredential.user;
        const userData = {
          ID: fbUser.uid,
          userName: fbUser.displayName,
          email: fbUser.email,
          avatar: fbUser.photoURL,
          marketingEmails: false,
          collections: [],
          lovedSongs: [],
          lovedCollections: [],
          followers: [],
          following: [],
        };
        await api.ensureMe(userData);
        await getUser(fbUser.uid);
        router.push(`/profile/${fbUser.uid}`);
      })
      .catch((error) => {
        throw new Error(error.code);
      });
  };

  const signin = (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Signed in
        const user = userCredential.user;
        getUser(user.uid);
        router.push(`/profile/${user.uid}`);
      })
      .catch((error) => {
        const errorCode = error.code;
        throw new Error(errorCode); // Return the error code to the frontend
      });
  };

  // getUser is always called for the CURRENT user (getUser(user.ID)), so
  // api.getMe() -- which derives the uid from the verified token -- is
  // correct here. The uid param is kept for signature compatibility.
  const getUser = async (uid: string) => {
    void uid;
    const u = await api.getMe();
    if (u) setUser(u);
  };

  async function getProfileUser(uid: string) {
    return api.getProfile(uid);
  }

  const logout = async () => {
    signOut(auth)
      .then(() => {
        setUser({
          ID: "",
          docID: "",
          avatar: "",
          userName: "",
          email: "",
          marketingEmails: false,
          lovedSongs: [],
          collections: [],
          lovedCollections: [],
          followers: [],
          following: [],
        });
        router.push(`/`);
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const likeAudio = async (audio: Audio) => {
    if (!user.ID) return;
    try {
      await api.likeAudio(audio);
      await getUser(user.ID);
    } catch (error) {
      console.error(error);
      throw new Error((error as Error).message);
    }
  };

  const dislikeAudio = async (audio: Audio) => {
    if (!user.ID) return;
    try {
      await api.dislikeAudio(audio.ID);
      await getUser(user.ID);
    } catch (error) {
      console.error(error);
      throw new Error((error as Error).message);
    }
  };

  async function getUserCollections(uid: string) {
    return api.getUserCollections(uid);
  }

  const addCollection = async (collection_0001: Collection) => {
    if (user.ID) {
      if (collection_0001.title) {
        try {
          await api.addCollection(collection_0001);
          router.push(`/collections/${user.ID}`);
        } catch (error: any) {
          const errorCode = error.code;
          throw new Error(errorCode); // Return the error code to the frontend
        }
      }
    }
  };

  const likeCollection = async (col: Collection) => {
    if (user.ID) {
      try {
        await api.likeCollection(col.ID);
        await getUser(user.ID);
      } catch (error) {
        console.error(error);
        throw new Error((error as Error).message);
      }
    }
  };

  const dislikeCollection = async (col: Collection) => {
    if (user.ID) {
      try {
        await api.dislikeCollection(col.ID);
        await getUser(user.ID);
      } catch (error) {
        console.error(error);
        throw new Error((error as Error).message);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        signin,
        signup,
        signupPopup,
        signinPopup,
        logout,
        getUser,
        likeAudio,
        dislikeAudio,
        addCollection,
        likeCollection,
        dislikeCollection,
        getProfileUser,
        getUserCollections,
      }}
    >
      {loading ? <Loader /> : children}
    </AuthContext.Provider>
  );
};
