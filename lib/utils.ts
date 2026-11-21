export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const timeAgo = (isoDate: string): string => {
  if (!isoDate) return "";
  try {
    const date = new Date(isoDate);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
    return `${Math.floor(seconds / 86400)} d ago`;
  } catch { return ""; }
};

export const getSaleTimeDetails = (endDateStr?: string) => {
  if (!endDateStr) return { text: "", isLessThanOneHour: false, isLessThan24Hours: false };
  try {
    const endDate = new Date(endDateStr);
    const diff = endDate.getTime() - new Date().getTime();
    if (diff <= 0) return { text: "Expired", isLessThanOneHour: false, isLessThan24Hours: false };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const minutes = Math.floor(diff / (1000 * 60)) % 60;

    let text = "";
    if (diff < 3600000) text = `${minutes}m`;
    else if (hours < 24) text = `${hours}h ${minutes}m`;
    else text = `${days}d`;

    return { text, isLessThanOneHour: diff < 3600000, isLessThan24Hours: hours < 24 };
  } catch { return { text: "", isLessThanOneHour: false, isLessThan24Hours: false }; }
};

export const getDaysSinceUpdate = (dateString?: string): number => {
  if (!dateString) return -1;
  try {
    const date = new Date(dateString);
    const diff = new Date().getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  } catch { return -1; }
};