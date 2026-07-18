import { useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import type { Route } from "./+types/route";

export default function BlogRedirect() {
  const { year, "*": splat } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/musings/${year}/${splat}`, { replace: true });
  }, [year, splat, navigate]);
  return null;
}
