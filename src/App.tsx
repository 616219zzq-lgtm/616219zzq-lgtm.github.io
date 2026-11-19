import DiscPreview from "./gallery/DiscPreview";
import GalleryView from "./gallery/GalleryView";

export default function App() {
  return new URLSearchParams(location.search).has("preview") ? <DiscPreview /> : <GalleryView />;
}
