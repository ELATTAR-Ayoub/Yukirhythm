import type { User, Collection } from "@/constants/interfaces";

export function shapeUser(uid: string, d: any): User {
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

export function shapeCollection(id: string, c: any): Collection {
  return {
    ID: id,
    title: c.title,
    desc: c.desc,
    thumbnails: [...c.thumbnails],
    owner: {
      ID: c.owner.ID,
      docID: c.owner.docID,
      name: c.owner.name,
      avatar: c.owner.profilePic,
    },
    audio: [...c.audio],
    likes: c.likes,
    tags: [...c.tags],
    date: c.date,
    private: c.private,
    collectionLengthSec: c.collectionLengthSec,
  };
}
