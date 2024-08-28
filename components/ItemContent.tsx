import { AudioTrackSelector } from "@/components/AudioTrackSelector";
import { Bitrate, BitrateSelector } from "@/components/BitrateSelector";
import { DownloadItem } from "@/components/DownloadItem";
import { OverviewText } from "@/components/OverviewText";
import { ParallaxScrollView } from "@/components/ParallaxPage";
import { PlayButton } from "@/components/PlayButton";
import { PlayedStatus } from "@/components/PlayedStatus";
import { SimilarItems } from "@/components/SimilarItems";
import { SubtitleTrackSelector } from "@/components/SubtitleTrackSelector";
import { ItemImage } from "@/components/common/ItemImage";
import { CastAndCrew } from "@/components/series/CastAndCrew";
import { CurrentSeries } from "@/components/series/CurrentSeries";
import { SeasonEpisodesCarousel } from "@/components/series/SeasonEpisodesCarousel";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import { useSettings } from "@/utils/atoms/settings";
import { getLogoImageUrlById } from "@/utils/jellyfin/image/getLogoImageUrlById";
import { getStreamUrl } from "@/utils/jellyfin/media/getStreamUrl";
import { getUserItemData } from "@/utils/jellyfin/user-library/getUserItemData";
import { chromecastProfile } from "@/utils/profiles/chromecast";
import ios from "@/utils/profiles/ios";
import native from "@/utils/profiles/native";
import old from "@/utils/profiles/old";
import { MediaSourceInfo } from "@jellyfin/sdk/lib/generated-client/models";
import { getMediaInfoApi } from "@jellyfin/sdk/lib/utils/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useNavigation } from "expo-router";
import { useAtom } from "jotai";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useCastDevice } from "react-native-google-cast";
import { Chromecast } from "./Chromecast";
import { ItemHeader } from "./ItemHeader";
import { MediaSourceSelector } from "./MediaSourceSelector";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Loader } from "./Loader";
import { set } from "lodash";

export const ItemContent: React.FC<{ id: string }> = React.memo(({ id }) => {
  const [api] = useAtom(apiAtom);
  const [user] = useAtom(userAtom);

  const opacity = useSharedValue(0);
  const castDevice = useCastDevice();
  const navigation = useNavigation();
  const [settings] = useSettings();
  const [selectedMediaSource, setSelectedMediaSource] =
    useState<MediaSourceInfo | null>(null);
  const [selectedAudioStream, setSelectedAudioStream] = useState<number>(-1);
  const [selectedSubtitleStream, setSelectedSubtitleStream] =
    useState<number>(0);
  const [maxBitrate, setMaxBitrate] = useState<Bitrate>({
    key: "Max",
    value: undefined,
  });

  const [loadingImage, setLoadingImage] = useState(true);
  const [loadingLogo, setLoadingLogo] = useState(true);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  const fadeIn = () => {
    opacity.value = withTiming(1, { duration: 300 });
  };

  const fadeOut = (callback: any) => {
    opacity.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(callback)();
      }
    });
  };

  const headerHeightRef = useRef(0);

  const {
    data: item,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["item", id],
    queryFn: async () => {
      const res = await getUserItemData({
        api,
        userId: user?.Id,
        itemId: id,
      });

      return res;
    },
    enabled: !!id && !!api,
    staleTime: 60 * 1000 * 5,
  });

  const [localItem, setLocalItem] = useState(item);

  useEffect(() => {
    if (item) {
      if (localItem) {
        // Fade out current item
        fadeOut(() => {
          // Update local item after fade out
          setLocalItem(item);
          // Then fade in
          fadeIn();
        });
      } else {
        // If there's no current item, just set and fade in
        setLocalItem(item);
        fadeIn();
      }
    } else {
      // If item is null, fade out and clear local item
      fadeOut(() => setLocalItem(null));
    }
  }, [item]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        item && (
          <View className="flex flex-row items-center space-x-2">
            <Chromecast background="blur" width={22} height={22} />
            <DownloadItem item={item} />
            <PlayedStatus item={item} />
          </View>
        ),
    });
  }, [item]);

  useEffect(() => {
    if (item?.Type === "Episode") headerHeightRef.current = 400;
    else if (item?.Type === "Movie") headerHeightRef.current = 500;
  }, [item]);

  const { data: sessionData } = useQuery({
    queryKey: ["sessionData", item?.Id],
    queryFn: async () => {
      if (!api || !user?.Id || !item?.Id) return null;
      const playbackData = await getMediaInfoApi(api!).getPlaybackInfo({
        itemId: item?.Id,
        userId: user?.Id,
      });

      return playbackData.data;
    },
    enabled: !!item?.Id && !!api && !!user?.Id,
    staleTime: 0,
  });

  const { data: playbackUrl } = useQuery({
    queryKey: [
      "playbackUrl",
      item?.Id,
      maxBitrate,
      castDevice,
      selectedMediaSource,
      selectedAudioStream,
      selectedSubtitleStream,
      settings,
    ],
    queryFn: async () => {
      if (!api || !user?.Id || !sessionData) return null;

      let deviceProfile: any = ios;

      if (castDevice?.deviceId) {
        deviceProfile = chromecastProfile;
      } else if (settings?.deviceProfile === "Native") {
        deviceProfile = native;
      } else if (settings?.deviceProfile === "Old") {
        deviceProfile = old;
      }

      const url = await getStreamUrl({
        api,
        userId: user.Id,
        item,
        startTimeTicks: item?.UserData?.PlaybackPositionTicks || 0,
        maxStreamingBitrate: maxBitrate.value,
        sessionData,
        deviceProfile,
        audioStreamIndex: selectedAudioStream,
        subtitleStreamIndex: selectedSubtitleStream,
        forceDirectPlay: settings?.forceDirectPlay,
        height: maxBitrate.height,
        mediaSourceId: selectedMediaSource?.Id,
      });

      console.info("Stream URL:", url);

      return url;
    },
    enabled: !!sessionData && !!api && !!user?.Id && !!item?.Id,
    staleTime: 0,
  });

  const logoUrl = useMemo(() => getLogoImageUrlById({ api, item }), [item]);

  const loading = useMemo(() => {
    return Boolean(
      isLoading || isFetching || loadingImage || (logoUrl && loadingLogo)
    );
  }, [isLoading, isFetching, loadingImage, loadingLogo, logoUrl]);

  return (
    <View className="flex-1 relative">
      {loading && (
        <View className="absolute top-0 left-0 right-0 bottom-0 w-full h-full flex flex-col justify-center items-center z-50">
          <Loader />
        </View>
      )}
      <ParallaxScrollView
        className={`flex-1 ${loading ? "opacity-0" : "opacity-100"}`}
        headerHeight={headerHeightRef.current}
        headerImage={
          <>
            <Animated.View style={[animatedStyle, { flex: 1 }]}>
              {localItem && (
                <ItemImage
                  variant={
                    localItem.Type === "Movie" && logoUrl
                      ? "Backdrop"
                      : "Primary"
                  }
                  item={localItem}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                  onLoad={() => setLoadingImage(false)}
                  onError={() => setLoadingImage(false)}
                />
              )}
            </Animated.View>
          </>
        }
        logo={
          <>
            {logoUrl ? (
              <Image
                source={{
                  uri: logoUrl,
                }}
                style={{
                  height: 130,
                  width: "100%",
                  resizeMode: "contain",
                }}
                onLoad={() => setLoadingLogo(false)}
                onError={() => setLoadingLogo(false)}
              />
            ) : null}
          </>
        }
      >
        <View className="flex flex-col bg-transparent shrink">
          <View className="flex flex-col px-4 w-full space-y-2 pt-2 mb-2 shrink">
            <Animated.View style={[animatedStyle, { flex: 1 }]}>
              <ItemHeader item={localItem} className="mb-4" />
              {localItem ? (
                <View className="flex flex-row items-center justify-start w-full h-16">
                  <BitrateSelector
                    className="mr-1"
                    onChange={(val) => setMaxBitrate(val)}
                    selected={maxBitrate}
                  />
                  <MediaSourceSelector
                    className="mr-1"
                    item={localItem}
                    onChange={setSelectedMediaSource}
                    selected={selectedMediaSource}
                  />
                  {selectedMediaSource && (
                    <>
                      <AudioTrackSelector
                        className="mr-1"
                        source={selectedMediaSource}
                        onChange={setSelectedAudioStream}
                        selected={selectedAudioStream}
                      />
                      <SubtitleTrackSelector
                        source={selectedMediaSource}
                        onChange={setSelectedSubtitleStream}
                        selected={selectedSubtitleStream}
                      />
                    </>
                  )}
                </View>
              ) : (
                <View className="h-16">
                  <View className="bg-neutral-900 h-4 w-2/4 rounded-md mb-1"></View>
                  <View className="bg-neutral-900 h-10 w-3/4 rounded-lg"></View>
                </View>
              )}
            </Animated.View>

            <PlayButton item={item} url={playbackUrl} className="grow" />
          </View>

          {item?.Type === "Episode" && (
            <SeasonEpisodesCarousel item={item} loading={loading} />
          )}

          <OverviewText text={item?.Overview} className="px-4 mb-4" />

          <CastAndCrew item={item} className="mb-4" loading={loading} />

          {item?.Type === "Episode" && (
            <CurrentSeries item={item} className="mb-4" />
          )}
          <SimilarItems itemId={item?.Id} />

          <View className="h-16"></View>
        </View>
      </ParallaxScrollView>
    </View>
  );
});