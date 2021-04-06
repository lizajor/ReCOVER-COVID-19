path = '../results/historical_forecasts/';

forecast_date = datetime((now),'ConvertFrom','datenum', 'TimeZone', 'America/Los_Angeles');
dirname = datestr(forecast_date, 'yyyy-mm-dd');

fullpath = [path dirname];

if ~exist(fullpath, 'dir')
    mkdir(fullpath);
end

if strcmpi(prefix, 'us') || strcmpi(prefix, 'global')
    ihme_countries = readcell(['ihme_' prefix '.txt']);
else
    ihme_countries = countries;
    infec_un_0 = infec_un_20; % The default is set to be called _20 for "other" forecasts
    deaths_un_0 = deaths_un_20;
end

lowidx = popu < 1; % No lowidx
base_infec = data_4(:, T_full); base_deaths = deaths(:, T_full);
writetable(infec2table([base_infec infec_un_0], ihme_countries, lowidx, forecast_date-1, 1, 1), [fullpath '/' prefix '_forecasts_cases.csv']);
writetable(infec2table([base_deaths deaths_un_0], ihme_countries, lowidx, forecast_date-1, 1, 1), [fullpath '/' prefix '_forecasts_deaths.csv']);

writetable(infec2table(data_4, countries, zeros(length(countries), 1), datetime(2020, 1, 23), 1), [fullpath '/' prefix '_data.csv']);
writetable(infec2table(deaths, countries, zeros(length(countries), 1), datetime(2020, 1, 23), 1), [fullpath '/' prefix '_deaths.csv']);