import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Rotate3d, Image as ImageIcon, Loader } from "lucide-react";
import Image from "next/image";
import Product3D from "../three/Product";

function ProductImage({
  product,
  selectedImage,
  setSelectedImage,
  selectedColor,
}) {
  const [openCanvas, setOpenCanvas] = useState(true);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef();

  useEffect(() => {
    if (openCanvas) {
      gsap.to(canvasRef.current, { opacity: 1, duration: 0.5 });
    }
  }, [openCanvas]);

  return (
    <div className="flex flex-col relative overflow-hidden justify-between mx-4 mb-5 space-y-4 md:h-[31.3rem] md:flex-row md:mx-10 md:space-x-5 md:space-y-0">
      {openCanvas ? (
        <Canvas3DView
          canvasRef={canvasRef}
          selectedColor={selectedColor}
          onClose={() => setOpenCanvas(false)}
        />
      ) : (
        <StaticImageView
          product={product}
          selectedImage={selectedImage}
          setSelectedImage={setSelectedImage}
          loading={loading}
          setLoading={setLoading}
          onOpen3D={() => setOpenCanvas(true)}
        />
      )}
    </div>
  );
}
