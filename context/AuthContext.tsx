import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  setDoc,
  doc,
  updateDoc,
  query,
  where,
  getDoc,
} from "firebase/firestore";
import { auth, firestore } from "@/config/firebase";

// helpers
import { ensureUserDoc } from "@/lib/user/ensureUserDoc";

// components
import Loader from "@/components/Loader";

// route
import { useRouter, usePathname } from "next/navigation";

// constants
import { Owner, Audio, Collection, User } from "@/constants/interfaces";

const AuthContext = createContext<any>({});

export const useAuth = () => useContext(AuthContext);

// Adapts firebase's getDoc/setDoc to the ensureUserDoc UserDocOps shape.
const userDocOps = (ref: unknown) => ({
  ref,
  getDoc: (r: unknown) => getDoc(r as any),
  setDoc: (r: unknown, v: unknown) => setDoc(r as any, v as any),
});

export const AuthContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const router = useRouter();
  const AuthRequired = ["/collections/create", "/update-profile"];
  const pathname = usePathname();

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
      if (mounted && firebaseUser) {
        await getUser(firebaseUser.uid);
        console.log(firebaseUser);
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
      setLoading(false); // Set loading to false once everything is complete
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
    name: string,
    marketingEmails: Boolean
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
        const ref = doc(firestore, "users", fbUser.uid);
        await ensureUserDoc(userDocOps(ref), fbUser.uid, userData);
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
        const ref = doc(firestore, "users", fbUser.uid);
        await ensureUserDoc(userDocOps(ref), fbUser.uid, userData);
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
        const ref = doc(firestore, "users", fbUser.uid);
        await ensureUserDoc(userDocOps(ref), fbUser.uid, userData);
        await getUser(fbUser.uid);
        router.push(`/profile/${fbUser.uid}`);
      })
      .catch((error) => {
        throw new Error(error.code);
      });
  };

  const signin = (email: string, password: string) => {
    console.log("signInWithEmailAndPassword");

    return signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Signed in
        const user = userCredential.user;
        getUser(user.uid);
        router.push(`/profile/${user.uid}`);
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log(errorCode, errorMessage);
        throw new Error(errorCode); // Return the error code to the frontend
      });
  };

  const getUser = async (uid: string) => {
    const ref = doc(firestore, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const d = snap.data().userData;
    setUser({
      ID: d.ID,
      docID: uid,
      avatar: d.avatar,
      userName: d.userName,
      email: d.email,
      marketingEmails: d.marketingEmails,
      lovedSongs: [...(d.lovedSongs ?? [])],
      collections: [...(d.collections ?? [])],
      lovedCollections: [...(d.lovedCollections ?? [])],
      followers: [...(d.followers ?? [])],
      following: [...(d.following ?? [])],
    });
  };

  async function getProfileUser(uid: string) {
    const ref = doc(firestore, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return {};
    const d = snap.data().userData;
    return {
      ID: d.ID,
      docID: uid,
      avatar: d.avatar,
      userName: d.userName,
      email: d.email,
      marketingEmails: d.marketingEmails,
      lovedSongs: [...(d.lovedSongs ?? [])],
      collections: [...(d.collections ?? [])],
      lovedCollections: [...(d.lovedCollections ?? [])],
      followers: [...(d.followers ?? [])],
      following: [...(d.following ?? [])],
    };
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
        console.log(error);
      });

    console.log("logout");
  };

  const likeAudio = async (audio: Audio) => {
    console.log("in - likeAudio");

    if (
      user.ID &&
      user.lovedSongs.every((lovedSong: any) => lovedSong.ID !== audio.ID)
    ) {
      console.log("in in  - likeAudio");

      const data = {
        userData: {
          ID: user.ID,
          avatar: user.avatar,
          userName: user.userName,
          email: user.email,
          marketingEmails: user.marketingEmails,
          collections: [...user.collections],
          lovedCollections: [...user.lovedCollections],
          followers: [...user.followers],
          following: [...user.following],
          lovedSongs: [...user.lovedSongs, audio],
        },
      };
      try {
        const docRef = doc(firestore, "users", user.docID);
        updateDoc(docRef, data)
          .then((docRef) => {
            console.log("Entire Document has been updated successfully");
            if (user.ID) getUser(user.ID);
          })
          .catch((error) => {
            console.log(error);
          });
      } catch (error: any) {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log(errorCode, errorMessage);
        throw new Error(errorCode); // Return the error code to the frontend
      }
    }
  };

  const dislikeAudio = async (audio: Audio) => {
    if (user.ID) {
      const result = user.lovedSongs.filter((item) => item.ID !== audio.ID);

      const data = {
        userData: {
          ID: user.ID,
          avatar: user.avatar,
          userName: user.userName,
          email: user.email,
          marketingEmails: user.marketingEmails,
          collections: [...user.collections],
          lovedCollections: [...user.lovedCollections],
          followers: [...user.followers],
          following: [...user.following],
          lovedSongs: result,
        },
      };

      try {
        const docRef = doc(firestore, "users", user.docID);
        updateDoc(docRef, data)
          .then((docRef) => {
            console.log("Entire Document has been updated successfully");
            if (user.ID) getUser(user.ID);
          })
          .catch((error) => {
            console.log(error);
          });
      } catch (error: any) {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log(errorCode, errorMessage);
        throw new Error(errorCode); // Return the error code to the frontend
      }
    }
  };

  async function getUserCollections(uid: string) {
    const q = query(
      collection(firestore, "collections"),
      where("collectionData.owner.ID", "==", uid)
    );
    const querySnapshot = await getDocs(q);
    let collectionsData: Collection[] = [];

    try {
      querySnapshot.forEach((doc) => {
        const Data = {
          ID: doc.id,
          title: doc.data().collectionData.title,
          desc: doc.data().collectionData.desc,
          thumbnails: [...doc.data().collectionData.thumbnails],
          owner: {
            ID: doc.data().collectionData.owner.ID,
            docID: doc.data().collectionData.owner.docID,
            name: doc.data().collectionData.owner.name,
            avatar: doc.data().collectionData.owner.profilePic,
          },
          audio: [...doc.data().collectionData.audio],
          likes: doc.data().collectionData.likes,
          tags: [...doc.data().collectionData.tags],
          date: doc.data().collectionData.date,
          private: doc.data().collectionData.private,
          collectionLengthSec: doc.data().collectionData.collectionLengthSec,
        };
        collectionsData.push(Data);
      });
      return collectionsData;
    } catch (error: any) {
      const errorCode = error.code;
      const errorMessage = error.message;
      console.log(errorCode, errorMessage);
      throw new Error(errorCode); // Return the error code to the frontend
    }
  }

  const addCollection = async (collection_0001: Collection) => {
    if (user.ID) {
      //
      const collectionData = {
        title: collection_0001.title,
        desc: collection_0001.desc,
        thumbnails: [...collection_0001.thumbnails],
        owner: {
          ID: user.ID,
          docID: user.docID,
          name: user.userName,
          avatar: user.avatar,
        },
        audio: [...collection_0001.audio],
        likes: 0,
        tags: [...collection_0001.tags],
        date: collection_0001.date,
        private: collection_0001.private,
        collectionLengthSec: collection_0001.collectionLengthSec,
      };
      if (collectionData.title) {
        console.log(collectionData);
        try {
          const docRef = await addDoc(collection(firestore, "collections"), {
            collectionData,
          });
          console.log("Document written with ID: ", docRef.id);
          router.push(`/collections/${user.ID}`);
        } catch (error: any) {
          const errorCode = error.code;
          const errorMessage = error.message;
          console.log(errorCode, errorMessage);
          throw new Error(errorCode); // Return the error code to the frontend
        }
      }
    }
  };

  const likeCollection = async (col: Collection) => {
    if (user.ID) {
      const data = {
        userData: {
          ID: user.ID,
          avatar: user.avatar,
          userName: user.userName,
          email: user.email,
          marketingEmails: user.marketingEmails,
          collections: [...user.collections],
          lovedCollections: [...user.lovedCollections, col.ID],
          followers: [...user.followers],
          following: [...user.following],
          lovedSongs: [...user.lovedSongs],
        },
      };
      try {
        const docRef = doc(firestore, "users", user.docID);
        updateDoc(docRef, data)
          .then((docRef) => {
            console.log("Entire Document has been updated successfully");
            if (user.ID) getUser(user.ID);
          })
          .catch((error) => {
            console.log(error);
          });
      } catch (error: any) {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log(errorCode, errorMessage);
        throw new Error(errorCode); // Return the error code to the frontend
      }
    }

    if (col.ID) {
      const colData: any = { collectionData: {} };

      colData.collectionData = col;
      colData.collectionData.likes = col.likes + 1;

      try {
        const docRef = doc(firestore, "collections", col.ID);
        updateDoc(docRef, colData)
          .then((docRef) => {
            console.log("Entire Document has been updated successfully");
          })
          .catch((error) => {
            console.log(error);
          });
      } catch (error) {
        console.error("Error updating the collection: ", error);
      }
    }
  };

  const dislikeCollection = async (col: Collection) => {
    if (user.ID) {
      const result = user.lovedCollections.filter((item) => item !== col.ID);

      const data = {
        userData: {
          ID: user.ID,
          avatar: user.avatar,
          userName: user.userName,
          email: user.email,
          marketingEmails: user.marketingEmails,
          collections: [...user.collections],
          lovedCollections: result,
          followers: [...user.followers],
          following: [...user.following],
          lovedSongs: [...user.lovedSongs],
        },
      };

      try {
        const docRef = doc(firestore, "users", user.docID);
        updateDoc(docRef, data)
          .then((docRef) => {
            console.log("Entire Document has been updated successfully");
            if (user.ID) getUser(user.ID);
          })
          .catch((error) => {
            console.log(error);
          });
      } catch (error) {
        console.error("Error updating loved songs: ", error);
      }
    }

    if (col.ID) {
      const colData: any = { collectionData: {} };

      colData.collectionData = col;
      colData.collectionData.likes = col.likes - 1;

      try {
        const docRef = doc(firestore, "collections", col.ID);
        updateDoc(docRef, colData)
          .then((docRef) => {
            console.log("Entire Document has been updated successfully");
          })
          .catch((error) => {
            console.log(error);
          });
      } catch (error: any) {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log(errorCode, errorMessage);
        throw new Error(errorCode); // Return the error code to the frontend
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
