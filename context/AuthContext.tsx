import { createContext, use, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  getAuth,
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
} from "firebase/firestore";
import { auth, firestore } from "@/config/firebase";
import { async } from "@firebase/util";

// components
import Loader from "@/components/Loader";

// route
import { useRouter, usePathname } from "next/navigation";

// constants
import { Owner, Audio, Collection, User } from "@/constants/interfaces";

const AuthContext = createContext<any>({});

export const useAuth = () => useContext(AuthContext);

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
        // Signed in
        const user = userCredential.user;
        const userData = {
          ID: user.uid,
          userName: user.displayName ? user.displayName : name,
          email: user.email,
          avatar: avatar,
          marketingEmails: marketingEmails,
          collections: [],
          lovedSongs: [],
          lovedCollections: [],
          followers: [],
          following: [],
        };
        if (user.uid) {
          console.log(userData);
          try {
            const docRef = await addDoc(collection(firestore, "users"), {
              userData,
            });
            console.log("Document written with ID: ", docRef.id);
            router.push(`/profile/${userData.ID}`);
          } catch (e) {
            console.error("Error adding document: ", e);
          }
        }
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log(errorCode, errorMessage);
        return errorCode;
      });
  };

  // avatar = https://api.dicebear.com/5.x/lorelei/svg?seed=A

  const signupPopup = async (prov: string) => {
    console.log("signupPopup");
    let provider;
    if (prov == "facebook") {
      provider = new FacebookAuthProvider();
    } else {
      provider = new GoogleAuthProvider();
    }
    const auth = getAuth();

    signInWithPopup(auth, provider)
      .then(async (result) => {
        // This gives you a Google Access Token. You can use it to access the Google API.
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential!.accessToken;
        // The signed-in user info.
        const user = result.user;

        const userData = {
          ID: user.uid,
          userName: user.displayName,
          email: user.email,
          avatar: user.photoURL,
          marketingEmails: false,
          collections: [],
          lovedSongs: [],
          lovedCollections: [],
          followers: [],
          following: [],
        };
        if (user.uid) {
          console.log(userData);
          try {
            const docRef = await addDoc(collection(firestore, "users"), {
              userData,
            });
            console.log("Document written with ID: ", docRef.id);
            router.push(`/profile/${userData.ID}`);
          } catch (e) {
            console.error("Error adding document: ", e);
          }
        }
      })
      .catch((error) => {
        console.log("SIR, we have an error");
        const errorCode = error.code;
        const errorMessage = error.message;
        const email = error.customData.email;
        const credential = GoogleAuthProvider.credentialFromError(error);
        // ...
        console.log(errorCode, errorMessage);
        console.log(email, credential);
      });
  };

  const signinPopup = async (prov: string) => {
    console.log("signInWithPopup");

    let provider;
    if (prov == "facebook") {
      provider = new FacebookAuthProvider();
    } else {
      provider = new GoogleAuthProvider();
    }
    return signInWithPopup(auth, provider)
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
      });
  };

  const getUser = async (uid: string) => {
    const q = query(
      collection(firestore, "users"),
      where("userData.ID", "==", uid)
    );
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      setUser({
        ID: doc.data().userData.ID,
        avatar: doc.data().userData.avatar,
        userName: doc.data().userData.userName,
        email: doc.data().userData.email,
        marketingEmails: doc.data().userData.marketingEmails,
        lovedSongs: [...doc.data().userData.lovedSongs],
        collections: [...doc.data().userData.collections],
        lovedCollections: [...doc.data().userData.lovedCollections],
        followers: [...doc.data().userData.followers],
        following: [...doc.data().userData.following],
      });

      // const userData = {
      //   ID: doc.data().userData.ID,
      //   avatar: doc.data().userData.avatar,
      //   userName: doc.data().userData.userName,
      //   email: doc.data().userData.email,
      //   marketingEmails: doc.data().userData.marketingEmails,
      //   lovedSongs: [...doc.data().userData.lovedSongs],
      //   collections: [...doc.data().userData.collections],
      //   lovedCollections: [...doc.data().userData.lovedCollections],
      //   followers: [...doc.data().userData.followers],
      //   following: [...doc.data().userData.following],
      // };

      // console.log("userData", userData);

      // return userData;
    });

    console.log("getUser");
  };

  const logout = async () => {
    signOut(auth)
      .then(() => {
        setUser({
          ID: "",
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

  const likeMusic = async (audio: Audio) => {
    if (user.ID) {
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
        const docRef = doc(firestore, "users", user.ID);
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
  };

  const dislikeMusic = async (audio: Audio) => {
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
        const docRef = doc(firestore, "users", user.ID);
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
  };

  const AddCollection = async (collection_0001: any) => {
    if (user.ID) {
      //
      const collectionData = {
        title: collection_0001.title,
        desc: collection_0001.desc,
        thumbnails: [...collection_0001.thumbnails],
        ownerID: user.ID,
        ownerUserName: user.userName,
        audio: [...collection_0001.music],
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
          router.push(`/collections/${docRef.id}`);
        } catch (e) {
          console.error("Error adding document: ", e);
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
        const docRef = doc(firestore, "users", user.ID);
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
        const docRef = doc(firestore, "users", user.ID);
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
      } catch (error) {
        console.error("Error updating the collection: ", error);
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
        likeMusic,
        dislikeMusic,
        AddCollection,
        likeCollection,
        dislikeCollection,
      }}
    >
      {loading ? <Loader /> : children}
    </AuthContext.Provider>
  );
};
