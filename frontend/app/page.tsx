import type { Metadata } from "next";
import { IntegrationPage } from "@/_pages/integration";

export const metadata: Metadata = { title: { absolute: "Орби — интеграция в вашу платформу" }, description: "Запуск, встраивание AI-спутника, подключение API и помощь Орби с установкой." };

export default function Page() {
  return <IntegrationPage />;
}
