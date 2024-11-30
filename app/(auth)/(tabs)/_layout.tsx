import React from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";

import { withLayoutContext } from "expo-router";

import {
  createNativeBottomTabNavigator,
  NativeBottomTabNavigationEventMap,
} from "react-native-bottom-tabs/react-navigation";

const { Navigator } = createNativeBottomTabNavigator();

import { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";

import { Colors } from "@/constants/Colors";
import type {
  ParamListBase,
  TabNavigationState,
} from "@react-navigation/native";
import { SystemBars } from "react-native-edge-to-edge";

export const NativeTabs = withLayoutContext<
  BottomTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  NativeBottomTabNavigationEventMap
>(Navigator);

export default function TabLayout() {
  const { t } = useTranslation();
  return (
    <>
      <SystemBars hidden={false} style="light" />
      <NativeTabs
        sidebarAdaptable
        ignoresTopSafeArea
        barTintColor={Platform.OS === "android" ? "#121212" : undefined}
        tabBarActiveTintColor={Colors.primary}
        scrollEdgeAppearance="default"
      >
        <NativeTabs.Screen redirect name="index" />
        <NativeTabs.Screen
          name="(home)"
          options={{
            title: t("tabs.home"),
            tabBarIcon:
              Platform.OS == "android"
                ? ({ color, focused, size }) =>
                    require("@/assets/icons/house.fill.png")
                : () => ({ sfSymbol: "house" }),
          }}
        />
        <NativeTabs.Screen
          name="(search)"
          options={{
            title: t("tabs.search"),
            tabBarIcon:
              Platform.OS == "android"
                ? ({ color, focused, size }) =>
                    require("@/assets/icons/magnifyingglass.png")
                : () => ({ sfSymbol: "magnifyingglass" }),
          }}
        />
        <NativeTabs.Screen
          name="(libraries)"
          options={{
            title: t("tabs.library"),
            tabBarIcon:
              Platform.OS == "android"
                ? ({ color, focused, size }) =>
                    require("@/assets/icons/server.rack.png")
                : () => ({ sfSymbol: "rectangle.stack" }),
          }}
        />
      </NativeTabs>
    </>
  );
}
