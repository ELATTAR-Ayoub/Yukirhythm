// styles
import styles from "../styles";
import "../styles/loader.css";

const Loader = () => {
  return (
    <div
      className={` fixed top-0 left-0 w-screen h-screen grid z-30 bg-primary`}
    >
      <div
        className={`center-in-screen animate-pulse w-12 h-12 bg-primary-white transition-all `}
      ></div>
    </div>
  );
};

export default Loader;
