import Link from "next/link";
// styles
import styles from "../styles";

// components
import SolidSvg from "./SolidSVG";

interface LoaderProps {
  mode?: "light" | "dark";
}

const Logo: React.FC<LoaderProps> = ({ mode = "dark" }) => {
  const svgColor = mode === "dark" ? "#2A292A" : "#F0F0F0"; // Adjust the colors based on mode

  return (
    <Link
      href="/"
      className={` ${styles.flexCenter} cursor-pointer w-4 md:w-7 aspect-square`}
    >
      <SolidSvg
        width={28}
        height={28}
        color={svgColor}
        src={"/svgs/logo.svg"}
        fit={true}
      />
    </Link>
  );
};

export default Logo;
