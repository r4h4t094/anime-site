import React from 'react'
import styles from "./page.module.css"
import { ApiDefaultResult, ApiMediaResults } from '../../ts/interfaces/apiAnilistDataInterface'
import gogoanime from '@/api/gogoanime'
import anilist from '@/api/anilist'
import CardMediaCoverAndDescription from '@/app/components/CardMediaCoverAndDescription'
import { EpisodeLinksGoGoAnime, MediaEpisodes } from '@/app/ts/interfaces/apiGogoanimeDataInterface'
import EpisodesSideListContainer from './components/EpisodesSideListContainer'
import CommentSectionContainer from '@/app/components/CommentSectionContainer'
import aniwatch from '@/api/aniwatch'
import Player from './components/VideoPlayer'
import { EpisodeAnimeWatch, EpisodeLinksAnimeWatch, EpisodesFetchedAnimeWatch } from '@/app/ts/interfaces/apiAnimewatchInterface'
import { fetchWithGoGoAnime } from '@/app/lib/fetchAnimeOnApi'
import { ImdbEpisode, ImdbMediaInfo } from '@/app/ts/interfaces/apiImdbInterface'
import { getMediaInfo } from '@/api/imdb'
import Image from 'next/image'
import ErrorImg from "@/public/error-img-4.png"
import Link from 'next/link'
import { getVideoSrcLink } from '@/api/vidsrc'
import { VidsrcEpisodeLink } from '@/app/ts/interfaces/apiVidsrcInterface'
import { SourceType } from '@/app/ts/interfaces/episodesSourceInterface'

export const revalidate = 900 // revalidate cached data every 15 minutes

export async function generateMetadata({ params, searchParams }: {
    params: { id: number }, // ANILIST ANIME ID
    searchParams: { episode: string, source: SourceType["source"], q: string } // EPISODE NUMBER, SOURCE, EPISODE ID
}) {

    const mediaData = await anilist.getMediaInfo(params.id) as ApiDefaultResult

    return {
        title: `Watching EP ${searchParams.episode} - ${mediaData.title.romaji} | AniProject`,
        description: `Watch ${mediaData.title.romaji}, episode ${searchParams.episode}. ${mediaData.description && mediaData.description}`,
    }
}

async function WatchEpisode({ params, searchParams }: {
    params: { id: number }, // ANILIST ANIME ID
    searchParams: { episode: string, source: SourceType["source"], q: string, t: string } // EPISODE NUMBER, SOURCE, EPISODE ID, TIME LAST STOP
}) {

    const mediaData = await anilist.getMediaInfo(params.id) as ApiMediaResults

    let episodeData
    let episodeSubtitles: EpisodeLinksAnimeWatch["tracks"] | VidsrcEpisodeLink["subtitles"] | undefined
    let episodes: EpisodeAnimeWatch[] | MediaEpisodes[] = []
    let videoSrc: string | undefined = undefined
    let imdbEpisodes: ImdbEpisode[] = []
    let vidsrcId: number | undefined = undefined
    let error = false

    switch (searchParams.source) {

        case ("gogoanime"):

            // fetch episode data
            episodeData = await gogoanime.getLinksForThisEpisode(searchParams.q) as EpisodeLinksGoGoAnime

            if (!episodeData) error = true

            if (episodeData) {

                // fetch episode link source
                videoSrc = (episodeData as EpisodeLinksGoGoAnime).sources.find(item => item.quality == "default").url
                if (!videoSrc) videoSrc = (episodeData as EpisodeLinksGoGoAnime).sources[0].url

                // fetch episodes for this media
                episodes = await fetchWithGoGoAnime(mediaData.title.romaji, "episodes") as MediaEpisodes[]

                // if episode on params dont match any of EPISODES results, it shows a error
                if (episodes.find(item => item.id == searchParams.q) == undefined) error = true

            }

            break

        case ("aniwatch"):

            // fetch episode data
            episodeData = await aniwatch.episodesLinks(searchParams.q) as EpisodeLinksAnimeWatch

            if (!episodeData) error = true

            if (episodeData) {

                // fetch episode link source
                videoSrc = episodeData.sources[0].url

                // fetch episodes for this media
                const mediaTitle = searchParams.q.slice(0, searchParams?.q.search(/\bep\b/)).slice(0, searchParams.q.slice(0, searchParams?.q.search(/\bep\b/)).length - 1)
                episodes = await aniwatch.getEpisodes(mediaTitle).then(res => (res as EpisodesFetchedAnimeWatch)?.episodes) as EpisodeAnimeWatch[]

                episodeSubtitles = episodeData.tracks

                // if episode on params dont match any of EPISODES results, it shows a error
                if (episodes.find(item => item.episodeId == searchParams.q) == undefined) error = true

            }

            break

        case ("vidsrc"):

            // fetch episode data
            episodeData = await getVideoSrcLink(`${searchParams.q}&e=${searchParams.episode}`) as VidsrcEpisodeLink

            if (!episodeData) error = true

            if (episodeData) {

                // fetch episode link source
                videoSrc = episodeData.source

                // vidsrc ID to be used on url
                vidsrcId = Number(searchParams.q.slice(0, searchParams?.q.search(/\bq\b/)).slice(0, searchParams.q.slice(0, searchParams?.q.search(/\bq\b/)).length - 3))

                // fetch episodes for this media
                episodes = await fetchWithGoGoAnime(mediaData.title.romaji, "episodes") as MediaEpisodes[]

                episodeSubtitles = episodeData.subtitles

            }

            break

        default:

            error = true

    }

    // get media info on imdb
    const imdbMediaInfo: ImdbMediaInfo = await getMediaInfo(true, undefined, undefined, mediaData.title.romaji, mediaData.startDate.year) as ImdbMediaInfo

    // get episodes on imdb
    imdbMediaInfo?.seasons?.map(itemA => itemA.episodes?.map(itemB => imdbEpisodes.push(itemB)))

    // ERROR MESSAGE
    if (error) {
        return (
            <div id={styles.error_modal_container}>

                <div id={styles.heading_text_container}>
                    <div>
                        <Image src={ErrorImg} height={330} alt={'Error'} />
                    </div>

                    <h1>ERROR!</h1>

                    <p>What could have happened: </p>

                    <ul>
                        <li>{`${searchParams.source} doesn't have this media available.`}</li>
                        <li>{`The Media ID doesn't match episode ID on ${searchParams.source}.`}</li>
                        <li>{`Problems With Server.`}</li>
                        <li>{`${searchParams.source} API changes or not available.`}</li>
                    </ul>
                </div>


                <div id={styles.redirect_btns_container}>
                    <Link href={`/media/${params.id}`}>
                        Return To Media Page
                    </Link>

                    <Link href={"/"}>
                        Return to Home Page
                    </Link>

                </div>

            </div>
        )
    }

    return (
        <main id={styles.container}>

            {/* PLAYER */}
            <div className={styles.background}>
                <section id={styles.video_container}>
                    <Player
                        source={videoSrc as string}
                        currentLastStop={searchParams.t || undefined}
                        mediaSource={searchParams.source}
                        vidsrcId={vidsrcId}
                        media={mediaData}
                        episodeIntro={(episodeData as EpisodeLinksAnimeWatch)?.intro}
                        episodeOutro={(episodeData as EpisodeLinksAnimeWatch)?.outro}
                        episodeNumber={searchParams.episode}
                        episodeImg={imdbEpisodes[Number(searchParams.episode) - 1]?.img?.hd || mediaData.bannerImage || null}
                        mediaEpisodes={episodes}
                        episodeId={searchParams.q}
                        subtitles={episodeSubtitles}
                        // videoQualities={searchParams.source == "gogoanime" ? (episodeData as EpisodeLinksGoGoAnime).sources : undefined}
                        videoQualities={undefined}
                    />
                </section>
            </div>

            <section id={styles.media_info_container}>

                <div id={styles.info_comments}>

                    <div id={styles.heading_info_container}>

                        {mediaData.format == "MOVIE" ? (
                            <h1 className='display_flex_row align_items_center'>
                                {mediaData.title.romaji || mediaData.title.native}
                            </h1>
                        ) : (
                            <h1>
                                {`Episode ${searchParams.episode}`}
                                <span>{" "}-{" "}</span>
                                <span>
                                    {
                                        imdbEpisodes?.find(item => item.episode == Number(searchParams.episode))?.title
                                        ||
                                        mediaData.title.romaji
                                        ||
                                        mediaData.title.native
                                    }
                                </span>
                            </h1>
                        )}

                        <CardMediaCoverAndDescription
                            data={mediaData as ApiDefaultResult}
                            showButtons={false}
                            customDescription={imdbEpisodes?.find(item => item.episode == Number(searchParams.episode))?.description || undefined}
                        />

                    </div>

                    <div className={styles.only_desktop}>

                        <div className={styles.comment_container}>

                            <h2>COMMENTS {mediaData.format != "MOVIE" && (`FOR EPISODE ${searchParams.episode}`)}</h2>

                            {/* ONLY ON DESKTOP */}
                            <CommentSectionContainer
                                media={mediaData}
                                onWatchPage={true}
                                episodeId={searchParams.q}
                                episodeNumber={Number(searchParams.episode)}
                            />
                        </div>

                    </div>

                </div>

                <div data-format={mediaData.format}>

                    {mediaData.format != "MOVIE" && (
                        <EpisodesSideListContainer
                            source={searchParams.source}
                            episodesList={episodes}
                            vidsrcId={vidsrcId}
                            episodesOnImdb={imdbEpisodes.length > 0 ? imdbEpisodes : undefined}
                            mediaId={params.id}
                            activeEpisodeNumber={Number(searchParams.episode)}
                        />
                    )}

                    {/* ONLY ON MOBILE */}
                    <div className={styles.only_mobile}>

                        <div className={styles.comment_container}>

                            <h2>COMMENTS {mediaData.format != "MOVIE" && (`FOR EPISODE ${searchParams.episode}`)}</h2>

                            <CommentSectionContainer
                                media={mediaData}
                                onWatchPage={true}
                                episodeId={searchParams.q}
                                episodeNumber={Number(searchParams.episode)}
                            />

                        </div>

                    </div>

                </div>

            </section>

        </main>
    )
}

export default WatchEpisode