import type { NextApiRequest, NextApiResponse } from "next";
import { Owner, Audio, User } from "@/constants/interfaces";

const { getVideo, getPlaylist, search } =
  require("@fabricio-191/youtube").setDefaultOptions({
    language: "en",
    location: "US",
    quantity: "all",
    requestsOptions: {},
  });

var Data: Audio = {
  ID: "",
  URL: "",
  title: "",
  thumbnails: [],
  audioLengthSec: 0,
  owner: {
    name: "",
    ID: "",
    canonicalURL: "",
    thumbnails: [],
  },
};

const searchAudio = (string: string, quantity: number) => {
  return new Promise((resolve, reject) => {
    search(string, { quantity: quantity })
      .then((data: any) => {
        if (data.results.length === 0) {
          reject(new Error("No video found"));
        } else {
          let video = data.results.filter((el: any) => el.type === "video")[0];
          console.log("video -------------------");
          console.log(video);

          Data.ID = video.ID;
          Data.URL = video.URL;
          Data.title = video.title;
          Data.thumbnails = [
            video.thumbnails[0].url,
            video.thumbnails[1] && video.thumbnails[1].url
              ? video.thumbnails[1].url
              : null,
          ];
          Data.owner = {
            name: video.owner.name,
            ID: video.owner.ID,
            canonicalURL: video.owner.canonicalURL,
            thumbnails: [video.owner.thumbnails[0].url],
          };
          Data.audioLengthSec = video.duration.number;

          // console.log('the returned is ' + Data);
          resolve(Data);
        }
      })
      .catch((error: Error) => {
        reject(error);
      });
  });
};

// searchAudio('quran yu baqara');

// export default function handler(
//     req: NextApiRequest,
//     res: NextApiResponse<Data>
// ) {
//     res.status(200).json({ name: 'Seach engine | youtube', object: Data })
// }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Audio>
) {
  try {
    console.log("you sent =>" + req.body.string);
    const data = await searchAudio(
      req.body.string as string,
      req.body.quantity as number
    );

    const responseData = { ...Data, object: data };
    res.status(200).json(responseData);
  } catch (error) {
    const errorAsError = error as Error;
    const responseData: Audio = { ...Data, message: errorAsError.message };
    res.status(404).json(responseData);
  }
}
