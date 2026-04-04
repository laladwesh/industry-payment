import api from "../api";
import { getDownloadFileName } from "./formatters";

export async function downloadRegistrationProof(registration) {
  const response = await api.get(`/n4p-zk/f3/${registration._id}`, {
    responseType: "blob",
  });

  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = getDownloadFileName(registration);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}
