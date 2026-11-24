import Image from "next/image";

const website = "zz2-pickleball.vercel.app/leagues";
const leaguesUrl = "https://" + website;

export function LeagueWebsiteNote() {
  return (
    <>
      For league dates, registration, full standings, player stats, and match history, visit{" "}
      <a href={leaguesUrl} className="break-all font-semibold text-yellow-300 underline underline-offset-4 hover:text-yellow-200">
        {website}
      </a>.
    </>
  );
}

export function LeagueWebsiteQr() {
  return (
    <a href={leaguesUrl} className="block shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-300">
      <Image
        src="/zz2-leagues-qr.png"
        alt="Scan to open the ZZ2 Leagues page"
        width={123}
        height={123}
        unoptimized
        loading="eager"
        className="size-[123px] [image-rendering:pixelated] [@media(min-height:900px)]:size-[164px]"
      />
    </a>
  );
}
