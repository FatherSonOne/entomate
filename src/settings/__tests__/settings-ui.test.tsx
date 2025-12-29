import React from "react";
import { render, screen } from "@testing-library/react";
import { SettingsProvider } from "../SettingsContext";
import { SettingsPage } from "../SettingsPage";

test("settings renders Appearance section", async () => {
  // Minimal fake fetch
  // @ts-ignore
  global.fetch = async (url: string, opts?: any) => {
    if (url.endsWith("/settings/user")) {
      return {
        json: async () => ({
          ok: true,
          settings: {
            user_id: "u1",
            theme_mode: "system",
            accent_mode: "system",
            accent_color: "#00A86B",
            reduce_motion: false,
            notifications_json: {},
            meetings_json: {},
            ai_json: {}
          }
        })
      } as any;
    }
    return { json: async () => ({ ok: true }) } as any;
  };

  render(
    <SettingsProvider baseUrl="http://localhost:3001" authHeaders={{ "x-user-id": "u1", "x-workspace-id": "w1" }} userRole="member">
      <SettingsPage />
    </SettingsProvider>
  );

  expect(await screen.findByText("Appearance")).toBeInTheDocument();
});
