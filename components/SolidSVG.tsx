// styles
import styles from '../styles';
import stylescss from '../styles/page.module.css';

interface SolidSvgProps {
    width: number,
    height: number,
    src: string,
    color?: string,
    className?: string,
    fit?: boolean
  }

export default function SolidSvg({ width, height, src, color, className = "", fit = false }: SolidSvgProps) {
	return <div className={className}>
		<style jsx>{`
			div {
				width: ${width}px;
				height: ${height}px;
				background-color: ${color};
				mask: url(${src});
				mask-repeat: no-repeat;
				mask-position: center;
				mask-size: ${fit ? "contain": "cover"};
			}
		`}</style>
	</div>
}