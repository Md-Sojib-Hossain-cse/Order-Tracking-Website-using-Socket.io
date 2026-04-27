import { useState } from "react";
import { useNavigate } from "react-router";

const TrackOrder = () => {
  const [searchValue, setSearchValue] = useState("");

  const navigate = useNavigate();

  const handleSearch = () => {
    console.log("Search value:", searchValue);
    navigate(`/track/${searchValue}`);
  };

  return (
    <div className="h-16 flex items-center justify-center gap-2">
      <input
        type="text"
        placeholder="Search by Order Id"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="border px-2 py-1 rounded"
      />

      <button
        onClick={handleSearch}
        className="bg-blue-500 text-white px-3 py-1 rounded"
      >
        Search
      </button>
    </div>
  );
};

export default TrackOrder;
