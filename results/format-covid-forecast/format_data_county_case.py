import math
import datetime
import pytz
import pandas as pd
import csv
import urllib.request
import io

FORECAST_DATE = datetime.datetime.now(pytz.timezone('US/Pacific'))
FORECAST_DATE = FORECAST_DATE.replace(tzinfo=None)
for i in range(0, 8):
    if FORECAST_DATE.weekday() == 6:
        break
    FORECAST_DATE -= datetime.timedelta(1)
# FIRST_WEEK is the first Saturday after forecast date.
FIRST_WEEK = FORECAST_DATE + datetime.timedelta(6)
# for i in range(0, 8):
#     if FIRST_WEEK.weekday() == 5:
#         break
#     FIRST_WEEK += datetime.timedelta(1)
INPUT_FILENAME = "county_forecasts_quarantine_0.csv"
OUTPUT_FILENAME = FORECAST_DATE.strftime("%Y-%m-%d") + "-USC-SI_kJalpha.csv"
COLUMNS = ["forecast_date", "target", "target_end_date", "location", "type", "quantile", "value"]
ID_REGION_MAPPING = {}

def load_id_region_mapping():
    """
    Return a mapping of <region id, region name>.
    """

    MAPPING_CSV = "./locations.csv"
    with open(MAPPING_CSV) as f:
        reader = csv.reader(f)
        id_region_mapping = {}

        # Skip the header
        next(reader)

        for row in reader:
            region_id = row[1]
            region_name = row[2]
            id_region_mapping[region_id] = region_name

        return id_region_mapping


def load_truth_cumulative_cases():
    dataset = {}
    with open("county_data.csv") as f:
        reader = csv.reader(f)
        header = next(reader, None)

        for row in reader:
            region_id = row[1].strip().zfill(5)
            if region_id not in ID_REGION_MAPPING:
                continue
            date = header[-1]
            val = int(row[-1])
            if date not in dataset:
                dataset[date] = {}

            dataset[date][region_id] = val

    return dataset


def load_csv(input_filename):
    """
    Read our forecast reports and return a dictionary structuring of <date_str, <region_id, value>>
    e.g.
    {
        "2020-06-22": {
            '10': 2000.0,
            '11': 3000.0,
            ...
        },

        "2020-06-23": {
            '10': 800.0,
            '11': 900.0,
            ...
        },
        ...
    }
    """
    dataset = {}
    with open(input_filename) as f:
        reader = csv.reader(f)
        header = next(reader, None)

        for i in range(2, len(header)):
            date_str = header[i]
            # Initialize the dataset entry on each date.
            dataset[date_str] = {}

        for row in reader:
            region_id = row[1].strip().zfill(5)

            # Skip the region if it is not listed in reichlab's region list.
            if region_id not in ID_REGION_MAPPING:
                continue

            for i in range(2, len(header)):
                date_str = header[i]
                val = float(row[i])
                if math.isnan(val) or val < 0:
                    val = 0
                dataset[date_str][region_id] = val

    return dataset


def generate_new_row(forecast_date, target, target_end_date,
                    location, type, quantile, value):
    """
    Return a new row to be added to the pandas dataframe.
    """
    new_row = {}
    new_row["forecast_date"] = forecast_date
    new_row["target"] = target
    new_row["target_end_date"] = target_end_date
    new_row["location"] = location
    new_row["type"] = type
    new_row["quantile"] = quantile
    new_row["value"] = value
    return new_row



def add_to_dataframe(dataframe, forecast, observed):
    """
    Given a dataframe, forecast, and observed data,
    add county level weekly incident cases predictions to the dataframe.
    """

    # Write incident forecasts.
    cum_week = 0
    forecast_date_str = FORECAST_DATE.strftime("%Y-%m-%d")
    for target_end_date_str in sorted(forecast.keys()):
        target_end_date = datetime.datetime.strptime(target_end_date_str, "%Y-%m-%d")
        # Terminate the loop after 8 weeks of forecasts.
        if cum_week >= 8:
            break

        # Skip forecasts before the forecast date.
        if target_end_date <= FORECAST_DATE:
            continue

        if (target_end_date_str == FIRST_WEEK.strftime("%Y-%m-%d")) or \
        (target_end_date > FIRST_WEEK and target_end_date.weekday() == 5):
            cum_week += 1
            target = str(cum_week) + " wk ahead inc case"
            last_week_date = target_end_date - datetime.timedelta(7)
            last_week_date_str = last_week_date.strftime("%Y-%m-%d")

            if last_week_date_str in observed:
                for region_id in forecast[target_end_date_str].keys():
                    if region_id in observed[last_week_date_str]:
                        dataframe = dataframe.append(
                            generate_new_row(
                                forecast_date=forecast_date_str,
                                target=target,
                                target_end_date=target_end_date_str,
                                location=region_id,
                                type="point",
                                quantile="NA",
                                value=max(forecast[target_end_date_str][region_id]-observed[last_week_date_str][region_id], 0)
                            ), ignore_index=True)

            elif last_week_date_str in forecast:
                for region_id in forecast[target_end_date_str].keys():
                    dataframe = dataframe.append(
                        generate_new_row(
                            forecast_date=forecast_date_str,
                            target=target,
                            target_end_date=target_end_date_str,
                            location=region_id,
                            type="point",
                            quantile="NA",
                            value=max(forecast[target_end_date_str][region_id]-forecast[last_week_date_str][region_id], 0)
                        ), ignore_index=True)

    return dataframe


# Main function
if __name__ == "__main__":
    ID_REGION_MAPPING = load_id_region_mapping()
    print("loading forecast...")
    forecast = load_csv(INPUT_FILENAME)
    observed = load_truth_cumulative_cases()
    dataframe = pd.read_csv(OUTPUT_FILENAME, na_filter=False)
    dataframe = add_to_dataframe(dataframe, forecast, observed)
    print("writing files...")
    dataframe.to_csv(OUTPUT_FILENAME, index=False)
    print("done")
