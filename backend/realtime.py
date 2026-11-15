import os
import requests
import time

from datetime import datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
load_dotenv()
key = os.getenv("GO_API_KEY")

BASE_URL = "https://api.openmetrolinx.com/OpenDataAPI/api/V1"
HEADERS = {"Accept": "application/json"} #getting response back in json
TORONTO = ZoneInfo("America/Toronto") #to have a clear indicator of toronto time 
TIME_FORMAT = "%Y-%m-%d %H:%M:%S"
ROUTES = {
    "be-un": ("BE", "GT - Union Station"),
    "mo-mc":("00296", "43 - McMaster U"),
    "mc-mo": ("00310", "43 - Mount Pleasant GO"),
}
CACHE_SECONDS = 60 #in case someone spams fastAPI with 10000 requests in 1 minute, only 1 request will actually go to server
_cache = {} #stop_code --> (saved_at, lines)



def get_next_service(stop_code):
    #before we try and call the api for next stops, let's check the cache

    cached = _cache.get(stop_code)

    if cached and time.time() - cached[0] < CACHE_SECONDS:
        return cached[1]
    
    print("fetching from Metrolinx")
    
    url = f"{BASE_URL}/Stop/NextService/{stop_code}"
    # The API call follows GET api/V1/Stop/NextService/{StopCode}, BE=Bramalea

    params = {"key" : key}
    resp = requests.get(url, params=params, headers=HEADERS, timeout=10)
    resp.raise_for_status() #raises error incase we get a 4xx/5xx status code...
    
    data = resp.json() #data is like a python dict

    if data["Metadata"]["ErrorMessage"] == "No Content":
        _cache[stop_code] = (time.time(), [])
        return []
    if data["Metadata"]["ErrorCode"] != "200":
        raise RuntimeError(data["Metadata"]["ErrorMessage"])

    next_service = data.get("NextService") or {}
    
    lines = next_service.get("Lines") or []
    _cache[stop_code] = (time.time(), lines)
    return lines
    # we use .get() to prevent crashes

def filter_direction(lines, direction_name):
    return [line for line in lines if line["DirectionName"] == direction_name]
    # remember, lines is just a list of the next few trains/busses
    # list comprehension, so we end up having a list of all the trains/busses in our req'd direction

def next_three(lines):
    lines = sorted(lines, key=lambda line: line["ComputedDepartureTime"]) #this is because the provided list of trains/busses are unfortunately not already sorted
    return lines[:3] # just return the first 3 so we can display next 3 trains/busses

def to_timestamp(time_str):
    naive = datetime.strptime(time_str, TIME_FORMAT)
    return naive.replace(tzinfo=TORONTO).isoformat() #labelling timezone and everything
    # this is req'd because when we use google run, it will treat 2PM as UTC time, which is 5 huors off for us
    # after this function, we will know the time is 5 hours behind w/ respect to uTC and 4 hours when our time changes for daylight savings

def delay_minutes(line):
    scheduled = datetime.strptime(line["ScheduledDepartureTime"], TIME_FORMAT)
    computed = datetime.strptime(line["ComputedDepartureTime"], TIME_FORMAT)
    return round((computed - scheduled).total_seconds() / 60)

def simplify_formatting(line):
    return {
        "departs": to_timestamp(line["ComputedDepartureTime"]),
        "platform": line["ActualPlatform"] or line["ScheduledPlatform"],
        "trip": line["TripNumber"], 
        "delay_min": delay_minutes(line)
    }

def get_departures(stop_code, direction_name): #most important function, only one that api.py will call....
    lines = get_next_service(stop_code)
    lines = filter_direction(lines, direction_name)
    return [simplify_formatting(line) for line in next_three(lines)]


if __name__ == "__main__":
    print(get_departures("BE", "GT - Union Station"))
