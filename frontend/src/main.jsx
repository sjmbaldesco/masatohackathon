import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LoadScript } from "@react-google-maps/api";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { MAPS_API_KEY, LIBRARIES } from "./services/maps";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LoadScript googleMapsApiKey={MAPS_API_KEY ?? ""} libraries={LIBRARIES}>
          <App />
        </LoadScript>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
