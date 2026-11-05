import csv
import io
import zipfile #opens zip archives

with zipfile.ZipFile("data/GO-GTFS.zip") as archive: #opens zip files, while giving us object called archive to work with 
    with archive.open("stops.txt") as raw_file: # opens file inside zip
        with io.TextIOWrapper(raw_file, encoding="utf-8-sig", newline="") as file:
            #wraps bytes in something that reads them as text for DictReader
            reader = csv.DictReader(file)

            for row in reader:
                if row["stop_id"] in ("BE", "UN"):
                    print(row["stop_id"], row["stop_name"])