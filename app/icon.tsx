import { ImageResponse } from "next/og";

// Route segment config
export const runtime = "edge";

// Image metadata
export const size = {
  width: 42,
  height: 42,
};
export const contentType = "image/png";

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          background: "transparent",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="35"
          height="43"
          viewBox="0 0 35 43"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M19.0705 42.3599C17.8971 42.3599 17.0438 41.9866 16.5105 41.2399C16.0038 40.4933 15.8571 39.4399 16.0705 38.0799L17.7505 27.5999L18.5905 31.6399L11.5505 18.5599C11.0971 17.6799 10.9238 16.8533 11.0305 16.0799C11.1638 15.3066 11.5238 14.6799 12.1105 14.1999C12.7238 13.6933 13.5238 13.4399 14.5105 13.4399C15.3371 13.4399 16.0305 13.6266 16.5905 13.9999C17.1505 14.3733 17.6971 15.1066 18.2305 16.1999L22.3105 24.0799H20.8705L27.7905 15.7599C28.5371 14.8533 29.1905 14.2399 29.7505 13.9199C30.3371 13.5999 31.0438 13.4399 31.8705 13.4399C32.8305 13.4399 33.5905 13.7066 34.1505 14.2399C34.7105 14.7733 34.9905 15.4399 34.9905 16.2399C35.0171 17.0133 34.6971 17.7866 34.0305 18.5599L22.9105 31.6399L25.0705 27.5999L23.3105 38.7199C22.9105 41.1466 21.4971 42.3599 19.0705 42.3599Z"
            fill="white"
          />
          <path
            d="M7.52425 2C7.67116 6.09313 10.9554 9.37734 15.0485 9.52425C10.9554 9.67116 7.67116 12.9554 7.52425 17.0485C7.37734 12.9554 4.09313 9.67116 0 9.52425C4.09313 9.37734 7.37734 6.09313 7.52425 2Z"
            fill="white"
          />
          <path
            d="M13.5 0C13.5683 1.90397 15.096 3.43166 17 3.5C15.096 3.56834 13.5683 5.09603 13.5 7C13.4317 5.09603 11.904 3.56834 10 3.5C11.904 3.43166 13.4317 1.90397 13.5 0Z"
            fill="white"
          />
        </svg>
      </div>
    ),
    // ImageResponse options
    {
      // For convenience, we can re-use the exported icons size metadata
      // config to also set the ImageResponse's width and height.
      ...size,
    }
  );
}
