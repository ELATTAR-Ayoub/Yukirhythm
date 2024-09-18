import type { NextApiRequest, NextApiResponse } from "next";
import { Audio } from "@/constants/interfaces";

const { search } = require("@fabricio-191/youtube").setDefaultOptions({
  language: "en",
  location: "US",
  quantity: "all",
  requestsOptions: {},
});

var Data: Audio[] = [];

const searchAudio = (string: string, quantity: number) => {
  return new Promise((resolve, reject) => {
    search(string)
      .then((data: any) => {
        if (!data.results || data.results.length === 0) {
          reject(new Error("No video found"));
        } else {
          let videos = data.results
            .filter((el: any) => el.type === "video")
            .slice(0, quantity);

          let formattedData: Audio[] = [];

          videos.forEach((element: any) => {
            if (element && element.ID && element.URL && element.title) {
              formattedData.push({
                ID: element.ID,
                URL: element.URL,
                title: element.title,
                thumbnails: [
                  element.thumbnails[0]?.url || "",
                  element.thumbnails[1]?.url || "",
                ],
                owner: {
                  name: element.owner?.name || "Unknown",
                  ID: element.owner?.ID || "",
                  canonicalURL: element.owner?.canonicalURL || "",
                  thumbnails: [element.owner?.thumbnails[0]?.url || ""],
                },
                audioLengthSec: element.duration?.number || 0,
              });
            }
          });

          resolve(formattedData);
        }
      })
      .catch((error: Error) => {
        reject(error);
        console.error("Search Error:", error);
      });
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Audio[]>
) {
  try {
    console.log("you sent =>" + req.body.string);
    const data = await searchAudio(
      req.body.string as string,
      req.body.quantity as number
    );

    res.status(200).json(data as Audio[]);
    Data = [];
  } catch (error) {
    const errorAsError = error as Error;
    res.status(404).json({ message: errorAsError.message } as any);
    Data = [];
  }
}
