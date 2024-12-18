import React, { useCallback, useMemo, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DropdownMenu from "zeego/dropdown-menu";
import { useControlContext } from "./contexts/ControlContext";
import { useVideoContext } from "./contexts/VideoContext";
import {
  EmbeddedSubtitle,
  ExternalSubtitle,
  TranscodedSubtitle,
} from "./types";
import { useAtomValue } from "jotai";
import { apiAtom } from "@/providers/JellyfinProvider";
import { useLocalSearchParams, useRouter } from "expo-router";

interface DropdownViewProps {
  showControls: boolean;
  offline?: boolean; // used to disable external subs for downloads
}

const DropdownView: React.FC<DropdownViewProps> = ({
  showControls,
  offline = false,
}) => {
  const router = useRouter();
  const api = useAtomValue(apiAtom);
  const ControlContext = useControlContext();
  const mediaSource = ControlContext?.mediaSource;
  const item = ControlContext?.item;
  const isVideoLoaded = ControlContext?.isVideoLoaded;

  const videoContext = useVideoContext();
  const {
    subtitleTracks,
    audioTracks,
    setSubtitleURL,
    setSubtitleTrack,
    setAudioTrack,
  } = videoContext;

  const allSubtitleTracksForDirectPlay = useMemo(() => {
    if (mediaSource?.TranscodingUrl) return null;
    const embeddedSubs =
      subtitleTracks
        ?.map((s) => ({
          name: s.name,
          index: s.index,
          deliveryUrl: undefined,
        }))
        .filter((sub) => !sub.name.endsWith("[External]")) || [];

    const externalSubs =
      mediaSource?.MediaStreams?.filter(
        (stream) => stream.Type === "Subtitle" && !!stream.DeliveryUrl
      ).map((s) => ({
        name: s.DisplayTitle! + " [External]",
        index: s.Index!,
        deliveryUrl: s.DeliveryUrl,
      })) || [];

    // Combine embedded subs with external subs only if not offline
    if (!offline) {
      return [...embeddedSubs, ...externalSubs] as (
        | EmbeddedSubtitle
        | ExternalSubtitle
      )[];
    }
    return embeddedSubs as EmbeddedSubtitle[];
  }, [item, isVideoLoaded, subtitleTracks, mediaSource?.MediaStreams, offline]);

  const { subtitleIndex, audioIndex, bitrateValue } = useLocalSearchParams<{
    itemId: string;
    audioIndex: string;
    subtitleIndex: string;
    mediaSourceId: string;
    bitrateValue: string;
  }>();

  // Either its on a text subtitle or its on not on any subtitle therefore it should show all the embedded HLS subtitles.
  const isOnTextSubtitle =
    mediaSource?.MediaStreams?.find(
      (x) => x.Index === parseInt(subtitleIndex) && x.IsTextSubtitleStream
    ) || subtitleIndex === "-1";

  const allSubs =
    mediaSource?.MediaStreams?.filter((x) => x.Type === "Subtitle") ?? [];
  const textBasedSubs = allSubs.filter((x) => x.IsTextSubtitleStream);

  // This is used in the case where it is transcoding stream.
  const chosenSubtitle = textBasedSubs.find(
    (x) => x.Index === parseInt(subtitleIndex)
  );

  const intialSubtitleIndex =
    !bitrateValue || !isOnTextSubtitle
      ? parseInt(subtitleIndex)
      : chosenSubtitle && isOnTextSubtitle
      ? textBasedSubs.indexOf(chosenSubtitle)
      : -1;

  const [selectedSubtitleIndex, setSelectedSubtitleIndex] =
    useState<Number>(intialSubtitleIndex);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<Number>(
    parseInt(audioIndex)
  );

  // TODO: Need to account for the fact when user is on text-based subtitle at start.
  // Then the user swaps to another text based subtitle.
  // Then changes audio track.
  // The user will have the first text based subtitle selected still but it should be the second text based subtitle.
  const allSubtitleTracksForTranscodingStream = useMemo(() => {
    const disableSubtitle = {
      name: "Disable",
      index: -1,
      IsTextSubtitleStream: true,
    } as TranscodedSubtitle;
    if (isOnTextSubtitle) {
      const textSubtitles =
        subtitleTracks?.map((s) => ({
          name: s.name,
          index: s.index,
          IsTextSubtitleStream: true,
        })) || [];

      const imageSubtitles = allSubs
        .filter((x) => !x.IsTextSubtitleStream)
        .map(
          (x) =>
            ({
              name: x.DisplayTitle!,
              index: x.Index!,
              IsTextSubtitleStream: x.IsTextSubtitleStream,
            } as TranscodedSubtitle)
        );

      const textSubtitlesMap = new Map(textSubtitles.map((s) => [s.name, s]));
      const imageSubtitlesMap = new Map(imageSubtitles.map((s) => [s.name, s]));

      const sortedSubtitles = Array.from(
        new Set(
          allSubs
            .map((sub) => {
              const displayTitle = sub.DisplayTitle ?? "";
              if (textSubtitlesMap.has(displayTitle)) {
                return textSubtitlesMap.get(displayTitle);
              }
              if (imageSubtitlesMap.has(displayTitle)) {
                return imageSubtitlesMap.get(displayTitle);
              }
              return null;
            })
            .filter(
              (subtitle): subtitle is TranscodedSubtitle => subtitle !== null
            )
        )
      );

      return [disableSubtitle, ...sortedSubtitles];
    }

    const transcodedSubtitle: TranscodedSubtitle[] = allSubs.map((x) => ({
      name: x.DisplayTitle!,
      index: x.Index!,
      IsTextSubtitleStream: x.IsTextSubtitleStream!,
    }));

    return [disableSubtitle, ...transcodedSubtitle];
  }, [item, isVideoLoaded, subtitleTracks, mediaSource?.MediaStreams]);

  const ChangeTranscodingSubtitle = useCallback(
    (subtitleIndex: number) => {
      const queryParams = new URLSearchParams({
        itemId: item.Id ?? "", // Ensure itemId is a string
        audioIndex: audioIndex?.toString() ?? "",
        subtitleIndex: subtitleIndex?.toString() ?? "",
        mediaSourceId: mediaSource?.Id ?? "", // Ensure mediaSourceId is a string
        bitrateValue: bitrateValue,
      }).toString();

      // @ts-expect-error
      router.replace(`player/transcoding-player?${queryParams}`);
    },
    [mediaSource]
  );

  // Audio tracks for transcoding streams.
  const allAudio =
    mediaSource?.MediaStreams?.filter((x) => x.Type === "Audio").map((x) => ({
      name: x.DisplayTitle!,
      index: x.Index!,
    })) || [];
  const ChangeTranscodingAudio = useCallback(
    (audioIndex: number) => {
      const queryParams = new URLSearchParams({
        itemId: item.Id ?? "", // Ensure itemId is a string
        audioIndex: audioIndex?.toString() ?? "",
        subtitleIndex: subtitleIndex,
        mediaSourceId: mediaSource?.Id ?? "", // Ensure mediaSourceId is a string
        bitrateValue: bitrateValue,
      }).toString();

      // @ts-expect-error
      router.replace(`player/transcoding-player?${queryParams}`);
    },
    [mediaSource]
  );

  return (
    <View
      style={{
        position: "absolute",
        zIndex: 1000,
        opacity: showControls ? 1 : 0,
      }}
      className="p-4"
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <TouchableOpacity className="aspect-square flex flex-col bg-neutral-800/90 rounded-xl items-center justify-center p-2">
            <Ionicons name="ellipsis-horizontal" size={24} color={"white"} />
          </TouchableOpacity>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          loop={true}
          side="bottom"
          align="start"
          alignOffset={0}
          avoidCollisions={true}
          collisionPadding={8}
          sideOffset={8}
        >
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger key="subtitle-trigger">
              Subtitle
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent
              alignOffset={-10}
              avoidCollisions={true}
              collisionPadding={0}
              loop={true}
              sideOffset={10}
            >
              {!mediaSource?.TranscodingUrl &&
                allSubtitleTracksForDirectPlay?.map((sub, idx: number) => (
                  <DropdownMenu.CheckboxItem
                    key={`subtitle-item-${idx}`}
                    value={selectedSubtitleIndex === sub.index}
                    onValueChange={() => {
                      if ("deliveryUrl" in sub && sub.deliveryUrl) {
                        setSubtitleURL &&
                          setSubtitleURL(
                            api?.basePath + sub.deliveryUrl,
                            sub.name
                          );

                        console.log(
                          "Set external subtitle: ",
                          api?.basePath + sub.deliveryUrl
                        );
                      } else {
                        console.log("Set sub index: ", sub.index);
                        setSubtitleTrack && setSubtitleTrack(sub.index);
                      }

                      setSelectedSubtitleIndex(sub.index);
                      console.log("Subtitle: ", sub);
                    }}
                  >
                    <DropdownMenu.ItemTitle key={`subtitle-item-title-${idx}`}>
                      {sub.name}
                    </DropdownMenu.ItemTitle>
                  </DropdownMenu.CheckboxItem>
                ))}
              {mediaSource?.TranscodingUrl &&
                allSubtitleTracksForTranscodingStream?.map(
                  (sub, idx: number) => (
                    <DropdownMenu.CheckboxItem
                      value={selectedSubtitleIndex === sub.index}
                      key={`subtitle-item-${idx}`}
                      onValueChange={() => {
                        if (selectedSubtitleIndex === sub?.index) return;
                        setSelectedSubtitleIndex(sub.index);
                        if (sub.IsTextSubtitleStream && isOnTextSubtitle) {
                          setSubtitleTrack && setSubtitleTrack(sub.index);
                          return;
                        }

                        ChangeTranscodingSubtitle(sub.index);
                      }}
                    >
                      <DropdownMenu.ItemTitle
                        key={`subtitle-item-title-${idx}`}
                      >
                        {sub.name}
                      </DropdownMenu.ItemTitle>
                    </DropdownMenu.CheckboxItem>
                  )
                )}
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger key="audio-trigger">
              Audio
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent
              alignOffset={-10}
              avoidCollisions={true}
              collisionPadding={0}
              loop={true}
              sideOffset={10}
            >
              {!mediaSource?.TranscodingUrl &&
                audioTracks?.map((track, idx: number) => (
                  <DropdownMenu.CheckboxItem
                    key={`audio-item-${idx}`}
                    value={selectedAudioIndex === track.index}
                    onValueChange={() => {
                      setSelectedAudioIndex(track.index);
                      setAudioTrack && setAudioTrack(track.index);
                    }}
                  >
                    <DropdownMenu.ItemTitle key={`audio-item-title-${idx}`}>
                      {track.name}
                    </DropdownMenu.ItemTitle>
                  </DropdownMenu.CheckboxItem>
                ))}
              {mediaSource?.TranscodingUrl &&
                allAudio?.map((track, idx: number) => (
                  <DropdownMenu.CheckboxItem
                    key={`audio-item-${idx}`}
                    value={selectedAudioIndex === track.index}
                    onValueChange={() => {
                      if (selectedAudioIndex === track.index) return;
                      setSelectedAudioIndex(track.index);
                      ChangeTranscodingAudio(track.index);
                    }}
                  >
                    <DropdownMenu.ItemTitle key={`audio-item-title-${idx}`}>
                      {track.name}
                    </DropdownMenu.ItemTitle>
                  </DropdownMenu.CheckboxItem>
                ))}
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </View>
  );
};

export default DropdownView;
