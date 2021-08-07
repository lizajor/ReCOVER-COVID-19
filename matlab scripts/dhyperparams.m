%% Fixed death hyper-parameters

dk = 3;
djp = 7;
dalpha = 0.9;
dwin = 100; % Choose a lower number if death rates evolve

%% Override fixed values and search for best hyper-parameters
T_full = size(data_4, 2);
[best_death_hyperparam, one_hyperparam] = death_hyperparams(deaths, data_4_s, deaths_s, T_full, 7, popu, 0, best_param_list, un_from_file);
dk = best_death_hyperparam(:, 1);
djp = best_death_hyperparam(:, 2);
dwin = best_death_hyperparam(:, 3);
lags = best_death_hyperparam(:, 4);